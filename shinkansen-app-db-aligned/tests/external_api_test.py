import json
import os
import unittest
from typing import Any, Dict, Optional, Tuple
from urllib import error, parse, request


def env(name: str, default: Optional[str] = None) -> Optional[str]:
    value = os.getenv(name)
    if value is None or value == "":
        return default
    return value


def json_request(
    method: str,
    url: str,
    payload: Optional[Dict[str, Any]] = None,
    headers: Optional[Dict[str, str]] = None,
) -> Tuple[int, Dict[str, Any]]:
    body = None
    request_headers = {"Content-Type": "application/json"}
    if headers:
        request_headers.update(headers)

    if payload is not None:
        body = json.dumps(payload).encode("utf-8")

    req = request.Request(url, data=body, method=method, headers=request_headers)

    try:
        with request.urlopen(req) as response:
            raw = response.read().decode("utf-8")
            return response.status, json.loads(raw)
    except error.HTTPError as exc:
        raw = exc.read().decode("utf-8")
        try:
            return exc.code, json.loads(raw)
        except json.JSONDecodeError:
            return exc.code, {"ok": False, "error": {"message": raw}}


class ExternalApiTestCase(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.base_url = env("API_BASE_URL", "http://localhost:3000")
        cls.profile_email = env("TEST_PROFILE_EMAIL")
        cls.profile_link = env("TEST_PROFILE_LINK", "https://example.com/profile-link-test")
        cls.order_id = env("TEST_ORDER_ID")
        cls.order_link = env("TEST_ORDER_LINK", "https://example.com/order-link-test")
        cls.order_status = env("TEST_ORDER_STATUS")
        cls.admin_token = cls._resolve_admin_token()

    @classmethod
    def _resolve_admin_token(cls) -> str:
        direct_token = env("API_ADMIN_TOKEN")
        if direct_token:
            return direct_token

        supabase_url = env("NEXT_PUBLIC_SUPABASE_URL")
        anon_key = env("NEXT_PUBLIC_SUPABASE_ANON_KEY")
        admin_email = env("SUPABASE_ADMIN_EMAIL")
        admin_password = env("SUPABASE_ADMIN_PASSWORD")

        missing = [
            name
            for name, value in (
                ("NEXT_PUBLIC_SUPABASE_URL", supabase_url),
                ("NEXT_PUBLIC_SUPABASE_ANON_KEY", anon_key),
                ("SUPABASE_ADMIN_EMAIL", admin_email),
                ("SUPABASE_ADMIN_PASSWORD", admin_password),
            )
            if not value
        ]

        if missing:
            raise RuntimeError(
                "Defina API_ADMIN_TOKEN ou informe "
                "NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY, "
                "SUPABASE_ADMIN_EMAIL e SUPABASE_ADMIN_PASSWORD. "
                f"Faltando: {', '.join(missing)}"
            )

        token_url = f"{supabase_url.rstrip('/')}/auth/v1/token?grant_type=password"
        status, data = json_request(
            "POST",
            token_url,
            payload={"email": admin_email, "password": admin_password},
            headers={"apikey": anon_key},
        )

        if status != 200 or "access_token" not in data:
            raise RuntimeError(f"Falha ao obter token admin do Supabase: {data}")

        return data["access_token"]

    def auth_headers(self) -> Dict[str, str]:
        return {"Authorization": f"Bearer {self.admin_token}"}

    def test_profile_endpoint_requires_auth(self):
        status, data = json_request(
            "PATCH",
            f"{self.base_url}/api/external/profiles/by-email",
            payload={"email": "cliente@exemplo.com", "photoLink": "https://example.com/a"},
        )

        self.assertEqual(status, 401)
        self.assertFalse(data.get("ok", True))

    def test_update_profile_photo_link_by_email(self):
        if not self.profile_email:
            self.skipTest("Defina TEST_PROFILE_EMAIL para rodar este teste.")

        status, data = json_request(
            "PATCH",
            f"{self.base_url}/api/external/profiles/by-email",
            payload={"email": self.profile_email, "photoLink": self.profile_link},
            headers=self.auth_headers(),
        )

        self.assertEqual(status, 200, data)
        self.assertTrue(data["ok"])
        self.assertEqual(data["data"]["email"].lower(), self.profile_email.lower())
        self.assertEqual(data["data"]["photo_link"], self.profile_link)

    def test_update_order_photo_link_by_uuid(self):
        if not self.order_id:
            self.skipTest("Defina TEST_ORDER_ID para rodar este teste.")

        status, data = json_request(
            "PATCH",
            f"{self.base_url}/api/external/orders/{parse.quote(self.order_id)}",
            payload={"photoLink": self.order_link},
            headers=self.auth_headers(),
        )

        self.assertEqual(status, 200, data)
        self.assertTrue(data["ok"])
        self.assertEqual(data["data"]["orderId"], self.order_id)
        self.assertEqual(data["data"]["photo_link"], self.order_link)

    def test_update_order_status(self):
        if not self.order_id or not self.order_status:
            self.skipTest("Defina TEST_ORDER_ID e TEST_ORDER_STATUS para rodar este teste.")

        status, data = json_request(
            "PATCH",
            f"{self.base_url}/api/external/orders/{parse.quote(self.order_id)}",
            payload={"status": self.order_status},
            headers=self.auth_headers(),
        )

        self.assertEqual(status, 200, data)
        self.assertTrue(data["ok"])
        self.assertEqual(data["data"]["orderId"], self.order_id)
        self.assertEqual(data["data"]["status"], self.order_status)


if __name__ == "__main__":
    unittest.main(verbosity=2)
