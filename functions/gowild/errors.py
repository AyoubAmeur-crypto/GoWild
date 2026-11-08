from firebase_functions.https_fn import HttpsError, FunctionsErrorCode


def fail(code: str, message: str, app_code: str | None = None):
    raise HttpsError(FunctionsErrorCode(code), message, {"code": app_code or code.upper().replace("-", "_")})
