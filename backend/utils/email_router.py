ST_EMAIL = "sharon.teh@ascendpoint.com.au"
EC_EMAIL = "elayne.chin@ascendpoint.com.au"

# Routing rules keyed by doc_type (exact match first, then partial)
ROUTING_RULES = {
    "PAYG Notice":       {"recipient_type": "fixed",     "email": EC_EMAIL, "name": "Elayne Chin",  "template": "payg"},
    "SRO":               {"recipient_type": "job_admin"},
    "ASIC Corporate Key":{"recipient_type": "fixed",     "email": ST_EMAIL, "name": "Sharon Teh",   "template": "default"},
    "Refund Cheque":     {"recipient_type": "job_admin"},
    "Refund Hold":       {"recipient_type": "job_admin"},
    "TFN Letter":        {"recipient_type": "job_admin"},
    "ABN Letter":        {"recipient_type": "fixed",     "email": ST_EMAIL, "name": "Sharon Teh",   "template": "default"},
    "GST Letter":        {"recipient_type": "fixed",     "email": ST_EMAIL, "name": "Sharon Teh",   "template": "default"},
    "Notice of Assessment": {"recipient_type": "job_admin"},
}

# Email subject + body templates — replace payg body when ready
TEMPLATES = {
    "payg": {
        "subject": "PAYG Instalment Notice — {client_name}",
        "body": (
            "Hi Elayne,\n\n"
            "Please find attached the PAYG instalment notice for {client_name}.\n\n"
            "[PAYG template body — replace this text]\n\n"
            "Regards,\nAscendPoint"
        ),
    },
    "default": {
        "subject": "{doc_type} — {client_name}",
        "body": (
            "Hi,\n\n"
            "Please find attached the {doc_type} for {client_name}.\n\n"
            "Regards,\nAscendPoint"
        ),
    },
}


def get_routing(doc_type: str) -> dict | None:
    if not doc_type:
        return None
    # Exact match
    rule = ROUTING_RULES.get(doc_type)
    if rule:
        return rule
    # Partial match — handles AI variations like "ABN, GST letters"
    dt_lower = doc_type.lower()
    for key, val in ROUTING_RULES.items():
        if key.lower() in dt_lower or dt_lower in key.lower():
            return val
    return None


def render_email(template_key: str, client_name: str, doc_type: str) -> dict:
    tmpl = TEMPLATES.get(template_key, TEMPLATES["default"])
    return {
        "subject": tmpl["subject"].format(client_name=client_name, doc_type=doc_type),
        "body": tmpl["body"].format(client_name=client_name, doc_type=doc_type),
    }
