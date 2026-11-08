from datetime import date, datetime, timezone
from typing import Annotated, Literal
from pydantic import BaseModel, ConfigDict, Field, StringConstraints, model_validator

Currency = Literal["USD", "EUR", "GBP", "MAD", "JPY"]
Language = Literal["en", "fr"]
Identifier = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=512)]
ShortName = Annotated[str, StringConstraints(strip_whitespace=True, min_length=2, max_length=60)]


class Model(BaseModel):
    model_config = ConfigDict(extra="forbid", strict=True, allow_inf_nan=False)

    def json_data(self) -> dict:
        return self.model_dump(mode="json", exclude_none=True)


class Occupancy(Model):
    rooms: int = Field(ge=1, le=8)
    adults: int = Field(ge=1, le=16)
    childrenAges: list[Annotated[int, Field(ge=0, le=17)]] = Field(default_factory=list, max_length=10)

    @model_validator(mode="after")
    def each_room_has_adult(self):
        if self.adults < self.rooms:
            raise ValueError("Each room must include at least one adult.")
        return self


class Stay(Model):
    checkIn: Annotated[str, StringConstraints(pattern=r"^\d{4}-\d{2}-\d{2}$")]
    checkOut: Annotated[str, StringConstraints(pattern=r"^\d{4}-\d{2}-\d{2}$")]
    occupancy: Occupancy
    currency: Currency = "USD"

    @model_validator(mode="after")
    def valid_dates(self):
        start, end = date.fromisoformat(self.checkIn), date.fromisoformat(self.checkOut)
        if start < datetime.now(timezone.utc).date() or not 1 <= (end - start).days <= 90:
            raise ValueError("Choose future dates for a stay of 1 to 90 nights.")
        return self

    def context(self) -> dict:
        return {field: self.json_data()[field] for field in ("checkIn", "checkOut", "occupancy", "currency")}


class Search(Stay):
    destination: Annotated[str, StringConstraints(max_length=120)] | None = None
    placeId: Identifier | None = None
    cityName: Annotated[str, StringConstraints(max_length=80)] | None = None
    countryCode: Annotated[str, StringConstraints(min_length=2, max_length=2)] | None = None
    latitude: float | int | None = Field(default=None, ge=-90, le=90)
    longitude: float | int | None = Field(default=None, ge=-180, le=180)
    radiusKm: float | int = Field(default=15, ge=1, le=200)
    language: Language = "en"
    minPrice: float | int | None = Field(default=None, ge=0)
    maxPrice: float | int | None = Field(default=None, ge=0)
    minStarRating: int | None = Field(default=None, ge=1, le=5)
    propertyTypes: list[Literal["hotel", "resort", "villa", "boutique", "apartment"]] = Field(default_factory=list, max_length=5)
    amenities: list[Annotated[str, StringConstraints(max_length=80)]] = Field(default_factory=list, max_length=30)
    freeCancellationOnly: bool = False
    instantConfirmationOnly: bool = False
    sortBy: Literal["recommended", "price_asc", "price_desc", "rating_desc"] = "recommended"

    @model_validator(mode="after")
    def coordinates_pair(self):
        if (self.latitude is None) != (self.longitude is None):
            raise ValueError("Supply both latitude and longitude.")
        return self


class HotelStay(Stay):
    hotelId: Identifier


class Revalidate(HotelStay):
    offerId: Identifier


class Traveler(Model):
    firstName: ShortName
    lastName: ShortName
    email: Annotated[str, StringConstraints(pattern=r"^[^\s@]+@[^\s@]+\.[^\s@]+$", max_length=254)]
    phone: Annotated[str, StringConstraints(pattern=r"^\+?[0-9\s()-]{7,20}$")]
    nationality: Annotated[str, StringConstraints(min_length=2, max_length=2)] | None = None


class BookingInput(Revalidate):
    quoteId: Identifier
    leadGuest: Traveler
    specialRequests: Annotated[str, StringConstraints(strip_whitespace=True, max_length=500)] | None = None
    acceptedPolicies: Literal[True]


class Book(Model):
    idempotencyKey: Annotated[str, StringConstraints(min_length=8, max_length=128)]
    input: BookingInput


class ProfilePatch(Model):
    firstName: ShortName | None = None
    lastName: ShortName | None = None
    phone: Annotated[str, StringConstraints(pattern=r"^\+?[0-9\s()-]{7,20}$")] | None = None
    nationality: Annotated[str, StringConstraints(min_length=2, max_length=2)] | None = None
    preferredCurrency: Currency | None = None
    preferredLanguage: Language | None = None


class UpdateProfile(Model):
    patch: ProfilePatch


class Favorite(Model):
    hotelId: Identifier
    saved: bool


class Detail(Model):
    hotelId: Identifier
    currency: Currency = "USD"
    lang: Language = "en"


class Places(Model):
    q: Annotated[str, StringConstraints(strip_whitespace=True, max_length=120)]
    lang: Language = "en"


class BookingId(Model):
    bookingId: Identifier
