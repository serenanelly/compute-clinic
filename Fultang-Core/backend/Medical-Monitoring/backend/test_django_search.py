import os, sys
os.environ["DJANGO_SETTINGS_MODULE"] = "core.settings"
import django
django.setup()

from rest_framework.test import APIRequestFactory
from patient.views import PatientViewSet

factory = APIRequestFactory()

# Test sans headers (doit échouer avec 401/403)
req_noauth = factory.get("/api/medical-monitoring/patients/", {"search": "Mballa"})
view = PatientViewSet.as_view({"get": "list"})
resp = view(req_noauth)
print("Sans auth - Status:", resp.status_code)

# Test avec X-User-ID header (doit fonctionner)
req_auth = factory.get(
    "/api/medical-monitoring/patients/",
    {"search": "Mballa"},
    HTTP_X_USER_ID="test-id",
    HTTP_X_USER_ROLES="Receptionniste"
)
resp2 = view(req_auth)
resp2.accepted_renderer = __import__('rest_framework').renderers.JSONRenderer()
resp2.accepted_media_type = "application/json"
resp2.renderer_context = {}
print("Avec auth - Status:", resp2.status_code)
data = resp2.data
if isinstance(data, dict):
    print("Count:", data.get("count"))
    results = data.get("results", [])
    print("Results:", [(p.get("nom"), p.get("prenom")) for p in results])
else:
    print("Data:", str(data)[:200])
