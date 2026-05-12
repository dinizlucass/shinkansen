import json
import os
from typing import Any, Dict, Optional
from urllib import error, request


API_BASE_URL = os.getenv("API_BASE_URL", "http://localhost:3000")
SUPABASE_URL = os.getenv("NEXT_PUBLIC_SUPABASE_URL")
SUPABASE_ANON_KEY = os.getenv("NEXT_PUBLIC_SUPABASE_ANON_KEY")
SUPABASE_ADMIN_EMAIL = os.getenv("SUPABASE_ADMIN_EMAIL", "admin@exemplo.com")
SUPABASE_ADMIN_PASSWORD = os.getenv("SUPABASE_ADMIN_PASSWORD", "SUA_SENHA")


def api_request(
    method: str,
    path: str,
    payload: Optional[Dict[str, Any]] = None,
    token: Optional[str] = None,
) -> Dict[str, Any]:
    url = f"{API_BASE_URL.rstrip('/')}{path}"
    body = json.dumps(payload).encode("utf-8") if payload is not None else None
    auth_token = token or get_admin_token()

    req = request.Request(
        url,
        data=body,
        method=method,
        headers={
            "Authorization": f"Bearer {auth_token}",
            "Content-Type": "application/json",
        },
    )

    try:
        with request.urlopen(req) as response:
            return json.loads(response.read().decode("utf-8"))
    except error.HTTPError as exc:
        raw = exc.read().decode("utf-8")
        try:
            return json.loads(raw)
        except json.JSONDecodeError:
            return {"ok": False, "error": {"message": raw, "status": exc.code}}


def get_admin_token() -> str:
    token_url = f"{SUPABASE_URL.rstrip('/')}/auth/v1/token?grant_type=password"
    body = json.dumps(
        {
            "email": SUPABASE_ADMIN_EMAIL,
            "password": SUPABASE_ADMIN_PASSWORD,
        }
    ).encode("utf-8")

    req = request.Request(
        token_url,
        data=body,
        method="POST",
        headers={
            "apikey": SUPABASE_ANON_KEY,
            "Content-Type": "application/json",
        },
    )

    try:
        with request.urlopen(req) as response:
            data = json.loads(response.read().decode("utf-8"))
    except error.HTTPError as exc:
        raw = exc.read().decode("utf-8")
        raise RuntimeError(f"Falha ao obter token admin: {raw}") from exc

    access_token = data.get("access_token")
    if not access_token:
        raise RuntimeError(f"Falha ao obter token admin: {data}")

    return access_token


def update_profile_photo_link_by_email(email: str, photo_link: Optional[str], token: Optional[str] = None) -> Dict[str, Any]:
    return api_request(
        "PATCH",
        "/api/external/profiles/by-email",
        {
            "email": email,
            "photoLink": photo_link,
        },
        token=token,
    )


def update_order_photo_link(order_id: str, photo_link: Optional[str], token: Optional[str] = None) -> Dict[str, Any]:
    return api_request(
        "PATCH",
        f"/api/external/orders/{order_id}",
        {
            "photoLink": photo_link,
        },
        token=token,
    )


def update_order_status(order_id: str, status: str, token: Optional[str] = None) -> Dict[str, Any]:
    return api_request(
        "PATCH",
        f"/api/external/orders/{order_id}",
        {
            "status": status,
        },
        token=token,
    )


def update_order_status_and_photo_link(
    order_id: str,
    status: str,
    photo_link: Optional[str],
    token: Optional[str] = None,
) -> Dict[str, Any]:
    return api_request(
        "PATCH",
        f"/api/external/orders/{order_id}",
        {
            "status": status,
            "photoLink": photo_link,
        },
        token=token,
    )


if __name__ == "__main__":
    profile_email = "cliente@exemplo.com"
    order_id = "60564272-9b6d-4723-8836-b9fb87422bc8"
    example_link = "https://drive.google.com/drive/folders/SEU_LINK_AQUI"
    admin_token = get_admin_token()

    print("\n0. Token admin obtido com sucesso")
    print(admin_token[:24] + "...")

    print("\n1. Atualizar link do perfil por email")
    print(
        json.dumps(
            update_profile_photo_link_by_email(profile_email, example_link, token=admin_token),
            indent=2,
            ensure_ascii=False,
        )
    )

    print("\n2. Atualizar link do pedido")
    print(json.dumps(update_order_photo_link(order_id, example_link, token=admin_token), indent=2, ensure_ascii=False))

    print("\n3. Atualizar só o status do pedido")
    print(json.dumps(update_order_status(order_id, "recebido", token=admin_token), indent=2, ensure_ascii=False))

    print("\n4. Atualizar status e link juntos")
    print(
        json.dumps(
            update_order_status_and_photo_link(order_id, "finalizado", example_link, token=admin_token),
            indent=2,
            ensure_ascii=False,
        )
    )
