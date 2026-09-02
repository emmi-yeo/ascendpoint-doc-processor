import os
import smtplib
import logging
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText

logger = logging.getLogger(__name__)


def send_reset_email(to_email: str, reset_url: str):
    host = os.getenv("SMTP_HOST")
    port = int(os.getenv("SMTP_PORT", "587"))
    user = os.getenv("SMTP_USER")
    password = os.getenv("SMTP_PASS")
    from_addr = os.getenv("FROM_EMAIL", user)

    if not all([host, user, password]):
        raise RuntimeError("SMTP not configured. Set SMTP_HOST, SMTP_USER, SMTP_PASS in .env")

    msg = MIMEMultipart("alternative")
    msg["Subject"] = "Reset your AscendPoint password"
    msg["From"] = f"AscendPoint <{from_addr}>"
    msg["To"] = to_email

    text = f"Click the link below to reset your password (expires in 1 hour):\n\n{reset_url}\n\nIf you did not request this, ignore this email."
    html = f"""
    <div style="font-family:sans-serif;max-width:480px;margin:40px auto">
      <div style="background:#2563eb;padding:20px 24px;border-radius:12px 12px 0 0">
        <span style="color:white;font-weight:700;font-size:18px">AscendPoint</span>
      </div>
      <div style="background:#fff;border:1px solid #e2e8f0;border-top:none;padding:32px 24px;border-radius:0 0 12px 12px">
        <p style="color:#334155;font-size:15px">You requested a password reset. Click the button below — the link expires in <strong>1 hour</strong>.</p>
        <a href="{reset_url}" style="display:inline-block;margin:16px 0;padding:12px 28px;background:#2563eb;color:white;border-radius:8px;font-weight:600;text-decoration:none;font-size:14px">
          Reset Password
        </a>
        <p style="color:#94a3b8;font-size:12px;margin-top:24px">If you did not request this, you can safely ignore this email.</p>
      </div>
    </div>
    """

    msg.attach(MIMEText(text, "plain"))
    msg.attach(MIMEText(html, "html"))

    with smtplib.SMTP(host, port) as s:
        s.ehlo()
        s.starttls()
        s.login(user, password)
        s.sendmail(from_addr, [to_email], msg.as_string())

    logger.info(f"Password reset email sent to {to_email}")
