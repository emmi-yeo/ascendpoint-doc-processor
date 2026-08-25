import os
import json
import re
import io
import time
import datetime
import logging
from pathlib import Path

import fitz
import PIL.Image
import google.generativeai as genai
from dotenv import load_dotenv

load_dotenv()

logger = logging.getLogger(__name__)

genai.configure(api_key=os.getenv("GEMINI_API_KEY"))
_model = genai.GenerativeModel(
    "gemini-3.6-flash",
    generation_config=genai.GenerationConfig(response_mime_type="application/json"),
)

PROMPT = """You are analyzing the first page of a scanned accounting document for an Australian accounting firm.

Extract:
1. client_name: The client or entity the document is addressed to or belongs to. Remove any salutations (Mr, Mrs, Ms, Miss, Dr, etc.). Use the full name as written.

2. doc_type: Apply these rules in order and use the EXACT type name shown:

- If it says "holding your refund" or "we're holding your refund" → "Refund Hold"
- If a physical cheque is visible on the page → "Refund Cheque" (even if the page also shows a Statement of Account)
- If it mentions "PAYG instalments" or "pay as you go instalments" → "PAYG Notice"
- If it mentions "corporate key" or "IMPORTANT INFORMATION" with a corporate key number → "ASIC Corporate Key"
- If it says "Deregistration application" → "Deregistration Application"
- If it says "tax file number" or "TFN" as the main subject → "TFN Letter"
- If it says "Notice of Assessment" → "Notice of Assessment"
- If it says "Activity Statement" or "BAS" → "Activity Statement"
- If it is a bank statement → "Bank Statement"
- If it is an invoice → "Invoice"
- If it is a tax return → "Tax Return"
- If it is a financial statement → "Financial Statement"
- If it is a contract → "Contract"
- If none match → use a short 2-4 word name from the document title

Return valid JSON only:
{"client_name": "...", "doc_type": "..."}"""


def name_document(pdf_path: Path) -> dict:
    doc = fitz.open(pdf_path)
    page = doc[0]
    pix = page.get_pixmap(matrix=fitz.Matrix(2, 2))
    img_bytes = pix.tobytes("png")
    doc.close()

    img = PIL.Image.open(io.BytesIO(img_bytes))

    max_retries = 3
    for attempt in range(max_retries):
        try:
            logger.info(f"Calling Gemini for {pdf_path.name} (attempt {attempt + 1})")
            response = _model.generate_content([PROMPT, img])
            result = json.loads(response.text)
            logger.info(f"Gemini result for {pdf_path.name}: {result}")
            return {
                "client_name": result.get("client_name", ""),
                "doc_type": result.get("doc_type", ""),
            }
        except Exception as e:
            error_str = str(e)
            logger.error(f"Gemini error for {pdf_path.name} (attempt {attempt + 1}): {error_str}")

            if "429" in error_str and attempt < max_retries - 1:
                wait = 40
                logger.warning(f"Rate limited — waiting {wait}s before retry")
                time.sleep(wait)
                continue

            raise RuntimeError(f"AI processing failed: {error_str}") from e


def generate_filename(ai: dict) -> str:
    today = datetime.date.today().strftime("%Y%m%d")
    doc_type = re.sub(r"[^\w\s]", "", ai.get("doc_type", "Other")).strip()
    doc_type = re.sub(r"\s+", "_", doc_type)
    client = re.sub(r"[^\w\s]", "", ai.get("client_name", "Unknown")).strip()
    client = re.sub(r"\s+", "_", client)[:40]
    return f"{doc_type}_{client}_{today}.pdf"
