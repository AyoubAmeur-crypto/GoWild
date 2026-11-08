"""Managed credentials in deployment; anonymous DB transport only for local emulators."""
import os
from firebase_admin import firestore


def database():
    if os.environ.get("FUNCTIONS_EMULATOR") == "true" and os.environ.get("FIRESTORE_EMULATOR_HOST"):
        from google.auth.credentials import AnonymousCredentials
        from google.cloud.firestore import Client
        return Client(project=os.environ.get("GCLOUD_PROJECT", "demo-gowild"), credentials=AnonymousCredentials())
    return firestore.client()
