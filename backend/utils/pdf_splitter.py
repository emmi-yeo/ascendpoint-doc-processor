from pathlib import Path
import fitz


def split_pdf(pdf_path: Path, page_counts: list[int], output_dir: Path) -> list[Path]:
    doc = fitz.open(pdf_path)
    output_paths = []
    page_idx = 0

    for i, count in enumerate(page_counts):
        sub = fitz.open()
        sub.insert_pdf(doc, from_page=page_idx, to_page=page_idx + count - 1)
        out_path = output_dir / f"doc_{i}.pdf"
        sub.save(out_path)
        sub.close()
        output_paths.append(out_path)
        page_idx += count

    doc.close()
    return output_paths
