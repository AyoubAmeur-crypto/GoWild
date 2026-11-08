"""Firebase Functions v2 entry points. No standalone HTTP server is deployed."""
from firebase_admin import initialize_app
from firebase_functions import https_fn, options

initialize_app()
options.set_global_options(region="europe-west1", max_instances=10, timeout_sec=60)


def require_user(req: https_fn.CallableRequest) -> str:
    if req.auth is None or not req.auth.uid:
        raise https_fn.HttpsError(https_fn.FunctionsErrorCode.UNAUTHENTICATED, "Sign in with Firebase before calling this function.")
    return req.auth.uid


@https_fn.on_call()
def testConnection(req: https_fn.CallableRequest) -> dict:
    """The first deployment check: authenticate BEFORE obtaining or writing the DB."""
    uid = require_user(req)
    from gowild.runtime import database
    from datetime import datetime, timezone
    checked_at = datetime.now(timezone.utc).isoformat()
    ref = database().collection("connection_tests").document(uid)
    ref.set({"uid": uid, "checkedAt": checked_at, "region": "europe-west1"})
    return {"success": True, "uid": uid, "region": "europe-west1", "documentPath": ref.path, "checkedAt": checked_at}

# Supplier functions are deployed independently. testConnection/profile/favorites do
# not bind either secret, allowing the first deployment without supplier access.
from firebase_functions.params import SecretParam
from firebase_functions.https_fn import HttpsError
from pydantic import ValidationError
from gowild.providers import Supplier
from gowild.service import Service
from gowild.store import Store
import logging

LITEAPI_KEY = SecretParam("LITEAPI_KEY")
DUFFEL_ACCESS_TOKEN = SecretParam("DUFFEL_ACCESS_TOKEN")


def execute(req: https_fn.CallableRequest, operation: str, provider: str | None = None, credential: str = "") -> dict:
    uid = require_user(req)
    if not isinstance(req.data, dict):
        raise HttpsError(https_fn.FunctionsErrorCode.INVALID_ARGUMENT, "Expected a JSON object.")
    try:
        from gowild.runtime import database
        service = Service(Store(database(), uid), Supplier(provider, credential) if provider else None)
        if provider:
            data = dict(req.data)
            action = data.pop("action", None)
            if not isinstance(action, str):
                raise HttpsError(https_fn.FunctionsErrorCode.INVALID_ARGUMENT, "A supplier action is required.")
            return service.dispatch(action, data)
        if operation == "getProfile":
            return service.profile(req.auth.token)
        if operation == "updateProfile":
            return service.update_profile(req.data, req.auth.token)
        if operation == "getFavorites":
            return service.favorites()
        if operation == "setFavorite":
            return service.set_favorite(req.data)
        if operation == "listBookings":
            return service.list_bookings()
        return service.notifications()
    except HttpsError:
        raise
    except ValidationError as error:
        # Never echo rejected values (guest data, tokens, credentials) into errors.
        fields = [".".join(str(part) for part in item["loc"]) for item in error.errors()]
        raise HttpsError(https_fn.FunctionsErrorCode.INVALID_ARGUMENT, "Invalid request fields.", {"code": "VALIDATION_ERROR", "fields": fields}) from None
    except Exception as error:
        logging.error("goWild callable failed (%s, %s)", operation, type(error).__name__)
        raise HttpsError(https_fn.FunctionsErrorCode.INTERNAL, "The cloud operation failed. Reconcile any submitted reservation before retrying.") from None


@https_fn.on_call()
def getProfile(req: https_fn.CallableRequest) -> dict:
    return execute(req, "getProfile")


@https_fn.on_call()
def updateProfile(req: https_fn.CallableRequest) -> dict:
    return execute(req, "updateProfile")


@https_fn.on_call()
def getFavorites(req: https_fn.CallableRequest) -> dict:
    return execute(req, "getFavorites")


@https_fn.on_call()
def setFavorite(req: https_fn.CallableRequest) -> dict:
    return execute(req, "setFavorite")


@https_fn.on_call()
def listBookings(req: https_fn.CallableRequest) -> dict:
    return execute(req, "listBookings")


@https_fn.on_call()
def getNotifications(req: https_fn.CallableRequest) -> dict:
    return execute(req, "getNotifications")


@https_fn.on_call(secrets=[LITEAPI_KEY], timeout_sec=120)
def liteApi(req: https_fn.CallableRequest) -> dict:
    require_user(req)
    return execute(req, "liteApi", "liteapi", LITEAPI_KEY.value)


@https_fn.on_call(secrets=[DUFFEL_ACCESS_TOKEN], timeout_sec=120)
def duffelApi(req: https_fn.CallableRequest) -> dict:
    require_user(req)
    return execute(req, "duffelApi", "duffel", DUFFEL_ACCESS_TOKEN.value)
