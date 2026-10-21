'use client';

import {
  FormEvent,
  useEffect,
  useMemo,
  useState,
} from 'react';

import {
  useRouter,
  useSearchParams,
} from 'next/navigation';

import {
  searchHotels,
  sendBookingLink,
  getHotelCities,
} from '@/lib/api';

import {
  addDays,
  getToday,
  formatDisplayDate,
} from '@/lib/date';

import {
  Hotel,
  HotelRate,
  HotelRoom,
} from '@/types/hotel';

export default function SearchPage() {
  const router = useRouter();

  const searchParams = useSearchParams();

  const [city, setCity] = useState('');

  const [checkIn, setCheckIn] =
    useState(getToday());

  const [duration, setDuration] = useState(1);

  const [adults, setAdults] = useState(1);

  const [rooms, setRooms] = useState(1);

  const [loading, setLoading] = useState(false);

  const [error, setError] = useState('');

  const [hotels, setHotels] = useState<Hotel[]>([]);

  const [searched, setSearched] = useState(false);

  const [agentMode, setAgentMode] = useState(false);

  const [guestEmail, setGuestEmail] = useState('');

  const [sendingLink, setSendingLink] = useState(false);

  const [linkSent, setLinkSent] = useState(false);

  // City dropdown state
  const [cities, setCities] = useState<string[]>([]);

  const [citiesLoading, setCitiesLoading] =
    useState(false);

  const [citiesError, setCitiesError] =
    useState('');

  const [showCityOptions, setShowCityOptions] =
    useState(false);

  const checkOut = useMemo(
    () => addDays(checkIn, Number(duration)),
    [checkIn, duration],
  );

  /*
   * Fetch Canadian cities from the backend.
   */
  useEffect(() => {
    let cancelled = false;

    async function loadCities() {
      setCitiesLoading(true);
      setCitiesError('');

      try {
        const response = await getHotelCities('CA');

        if (!cancelled) {
          setCities(response.data.cities ?? []);
        }
      } catch (err) {
        if (!cancelled) {
          setCitiesError(
            err instanceof Error
              ? err.message
              : 'Unable to load cities',
          );
        }
      } finally {
        if (!cancelled) {
          setCitiesLoading(false);
        }
      }
    }

    loadCities();

    return () => {
      cancelled = true;
    };
  }, []);

  /*
   * Filter cities as the user types.
   */
  const filteredCities = useMemo(() => {
    const search = city.trim().toLowerCase();

    const matchingCities = search
      ? cities.filter((item) =>
          item.toLowerCase().includes(search),
        )
      : cities;

    return matchingCities.slice(0, 50);
  }, [cities, city]);

  /*
   * Restore search from URL.
   *
   * This is what makes the email link work.
   */
  useEffect(() => {
    const urlCity = searchParams.get('city');

    const urlCheckIn = searchParams.get('checkIn');

    const urlDuration = searchParams.get('duration');

    const urlAdults = searchParams.get('adults');

    const urlRooms = searchParams.get('rooms');

    const isAgent =
      searchParams.get('agent') === 'true';

    if (urlCity) {
      setCity(urlCity);
    }

    if (urlCheckIn) {
      setCheckIn(urlCheckIn);
    }

    if (urlDuration) {
      setDuration(Number(urlDuration));
    }

    if (urlAdults) {
      setAdults(Number(urlAdults));
    }

    if (urlRooms) {
      setRooms(Number(urlRooms));
    }

    setAgentMode(isAgent);

    if (urlCity && urlCheckIn) {
      performSearch({
        city: urlCity,
        checkIn: urlCheckIn,
        duration: Number(urlDuration ?? 1),
        adults: Number(urlAdults ?? 1),
        rooms: Number(urlRooms ?? 1),
      });
    }
  }, [searchParams]);

  async function performSearch(
    values: {
      city: string;
      checkIn: string;
      duration: number;
      adults: number;
      rooms: number;
    },
  ) {
    setLoading(true);
    setError('');

    try {
      const checkout = addDays(
        values.checkIn,
        values.duration,
      );

      const params = new URLSearchParams();

      params.set('city', values.city);

      params.set('checkIn', values.checkIn);

      params.set('checkOut', checkout);

      params.set('adults', String(values.adults));

      params.set('rooms', String(values.rooms));

      params.set('guestNationality', 'CA');

      params.set('page', '1');

      params.set('limit', '20');

      const response = await searchHotels(params);

      setHotels(response.data.hotels);

      setSearched(true);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Unable to search hotels',
      );
    } finally {
      setLoading(false);
    }
  }

  function handleSearch(event: FormEvent) {
    event.preventDefault();

    if (!city.trim()) {
      setError('Please select or enter a city');
      return;
    }

    if (!checkIn) {
      setError('Please select a check-in date');
      return;
    }

    if (duration < 1 || adults < 1 || rooms < 1) {
      setError(
        'Duration, adults, and rooms must be at least 1',
      );
      return;
    }

    setError('');

    const params = new URLSearchParams();

    params.set('city', city.trim());

    params.set('checkIn', checkIn);

    params.set('duration', String(duration));

    params.set('adults', String(adults));

    params.set('rooms', String(rooms));

    /*
     * Do not put agent=true in the
     * guest's email link.
     */
    if (agentMode) {
      params.set('agent', 'true');
    }

    router.push(`/?${params.toString()}`);
  }

  function selectRate(
    hotel: Hotel,
    room: HotelRoom,
    rate: HotelRate,
  ) {
    const params = new URLSearchParams();

    params.set('hotelId', hotel.hotelId);

    params.set('hotelName', hotel.name);

    params.set(
      'roomName',
      room.name ?? rate.name ?? '',
    );

    params.set('offerId', room.offerId);

    params.set('rateId', rate.rateId ?? '');

    params.set('city', city);

    params.set('checkIn', checkIn);

    params.set('checkOut', checkOut);

    params.set('adults', String(adults));

    params.set('rooms', String(rooms));

    params.set('guestNationality', 'CA');

    router.push(`/checkout?${params.toString()}`);
  }

  function buildGuestLink() {
    const url = new URL(window.location.href);

    /*
     * Remove agent mode from
     * the guest URL.
     */
    url.searchParams.delete('agent');

    return url.toString();
  }

  async function handleSendLink() {
    if (!guestEmail.trim()) {
      setError('Enter the guest email');
      return;
    }

    setSendingLink(true);
    setError('');
    setLinkSent(false);

    try {
      const link = buildGuestLink();

      await sendBookingLink(
        guestEmail.trim(),
        link,
      );

      setLinkSent(true);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Unable to send booking link',
      );
    } finally {
      setSendingLink(false);
    }
  }

  return (
    <main className="page">
      <header className="header">
        <div>
          <div className="brand">
            Instant Rebook
          </div>

          <div className="brand-subtitle">
            Hotel Booking
          </div>
        </div>

        <button
          type="button"
          className={
            agentMode
              ? 'mode-button active'
              : 'mode-button'
          }
          onClick={() => setAgentMode(!agentMode)}
        >
          {agentMode
            ? 'Front Desk Mode'
            : 'Guest Mode'}
        </button>
      </header>

      <section className="hero">
        <div className="hero-content">
          <span className="eyebrow">
            CANADA HOTEL BOOKING
          </span>

          <h1>
            {/* Find your next stay. */}
            Sold out? Rebook guest instantly
          </h1>

          <p>
            {/* Search available hotels and
            rooms across Canada. */}
            Find available hotels nearby  in seconds 
          </p>
        </div>
      </section>

      <section className="search-card">
        <form onSubmit={handleSearch}>
          <div className="form-grid">
            {/* City autocomplete */}
            <div className="field city-field">
              <label htmlFor="hotel-city">
                City
              </label>

              <div className="city-autocomplete">
                <input
                  id="hotel-city"
                  type="text"
                  value={city}
                  autoComplete="off"
                  placeholder="Search Canadian cities"
                  role="combobox"
                  aria-autocomplete="list"
                  aria-expanded={showCityOptions}
                  aria-controls="hotel-city-options"
                  onFocus={() =>
                    setShowCityOptions(true)
                  }
                  onChange={(event) => {
                    setCity(event.target.value);
                    setShowCityOptions(true);
                    setError('');
                  }}
                  onKeyDown={(event) => {
                    if (event.key === 'Escape') {
                      setShowCityOptions(false);
                    }

                    if (
                      event.key === 'Enter' &&
                      showCityOptions &&
                      filteredCities.length > 0
                    ) {
                      event.preventDefault();

                      setCity(filteredCities[0]);

                      setShowCityOptions(false);
                    }
                  }}
                />

                {showCityOptions && (
                  <div
                    id="hotel-city-options"
                    className="city-options"
                    role="listbox"
                  >
                    {citiesLoading && (
                      <div className="city-option-message">
                        Loading cities...
                      </div>
                    )}

                    {!citiesLoading &&
                      citiesError && (
                        <div className="city-option-message">
                          Unable to load cities.
                        </div>
                      )}

                    {!citiesLoading &&
                      !citiesError &&
                      filteredCities.length === 0 && (
                        <div className="city-option-message">
                          No matching cities found.
                        </div>
                      )}

                    {!citiesLoading &&
                      !citiesError &&
                      filteredCities.map((item) => (
                        <button
                          key={item}
                          type="button"
                          role="option"
                          aria-selected={city === item}
                          className={
                            city === item
                              ? 'city-option selected'
                              : 'city-option'
                          }
                          onClick={() => {
                            setCity(item);
                            setShowCityOptions(false);
                            setError('');
                          }}
                        >
                          <span>{item}</span>

                          {city === item && (
                            <span aria-hidden="true">
                              ✓
                            </span>
                          )}
                        </button>
                      ))}
                  </div>
                )}
              </div>

              {citiesError && (
                <small className="city-error">
                  Could not load cities. You can
                  still enter a city manually.
                </small>
              )}
            </div>

            {/* <div className="field">
              <label htmlFor="check-in">
                Check-in
              </label>

              <input
                id="check-in"
                type="date"
                value={checkIn}
                min={getToday()}
                onChange={(event) =>
                  setCheckIn(event.target.value)
                }
              />
            </div> */}

            <div className="field">
              <label htmlFor="duration">
                Duration
              </label>

              <input
                id="duration"
                type="number"
                min={1}
                value={duration}
                onChange={(event) =>
                  setDuration(
                    Number(event.target.value),
                  )
                }
              />

              <small>nights</small>
            </div>

            <div className="field">
              <label htmlFor="adults">
                Adults
              </label>

              <input
                id="adults"
                type="number"
                min={1}
                value={adults}
                onChange={(event) =>
                  setAdults(
                    Number(event.target.value),
                  )
                }
              />
            </div>

            {/* <div className="field">
              <label htmlFor="rooms">
                Rooms
              </label>

              <input
                id="rooms"
                type="number"
                min={1}
                value={rooms}
                onChange={(event) =>
                  setRooms(
                    Number(event.target.value),
                  )
                }
              />
            </div> */}

            {/* <div className="field">
              <label>Country</label>

              <div className="readonly">
                🇨🇦 Canada
              </div>
            </div>

            <div className="field">
              <label>Currency</label>

              <div className="readonly">
                CAD
              </div>
            </div> */}
          </div>

          <div className="search-summary">
            <span>
              {formatDisplayDate(checkIn)}
            </span>

            <span>→</span>

            <span>
              {formatDisplayDate(checkOut)}
            </span>

            <span className="summary-separator">
              |
            </span>

            <span>
              {adults} adult
              {adults !== 1 ? 's' : ''}
            </span>

            {/* <span>
              {rooms} room
              {rooms !== 1 ? 's' : ''}
            </span> */}
          </div>

          <button
            className="primary-button search-button"
            type="submit"
            disabled={loading}
          >
            {loading
              ? 'Searching...'
              : 'Search Hotels'}
          </button>
        </form>
      </section>

      {agentMode && searched && (
        <section className="share-card">
          <div>
            <span className="eyebrow">
              FRONT DESK
            </span>

            <h2>
              Send this search to the guest
            </h2>

            <p>
              The guest will receive a link and
              can continue the booking from this
              search.
            </p>
          </div>

          <div className="share-form">
            <input
              type="email"
              value={guestEmail}
              onChange={(event) =>
                setGuestEmail(event.target.value)
              }
              placeholder="guest@example.com"
            />

            <button
              type="button"
              className="primary-button"
              onClick={handleSendLink}
              disabled={sendingLink}
            >
              {sendingLink
                ? 'Sending...'
                : 'Send Booking Link'}
            </button>
          </div>

          {linkSent && (
            <div className="success">
              Booking link sent successfully.
            </div>
          )}
        </section>
      )}

      {error && (
        <div className="error">
          {error}
        </div>
      )}

      {searched && (
        <section className="results">
          <div className="results-header">
            <div>
              <span className="eyebrow">
                AVAILABLE HOTELS
              </span>

              <h2>
                {hotels.length} hotels available
              </h2>
            </div>

            <div className="results-date">
              {city} ·{' '}
              {formatDisplayDate(checkIn)} →{' '}
              {formatDisplayDate(checkOut)}
            </div>
          </div>

          {hotels.length === 0 && !loading && (
            <div className="empty">
              No hotels found for this search.
            </div>
          )}

          {/* <div className="hotel-list">
            {hotels.map((hotel) => (
              <HotelCard
                key={hotel.hotelId}
                hotel={hotel}
                onSelect={selectRate}
              />
            ))}
          </div> */}


          <div className="hotel-list">
            {hotels.map((hotel) => (
              <HotelCard
                key={hotel.hotelId}
                hotel={hotel}
                onSelect={selectRate}
                onViewDetails={(hotelId) =>
                  router.push(
                    `/hotel/${encodeURIComponent(hotelId)}`,
                  )
                }
              />
            ))}
          </div>
        </section>
      )}
    </main>
  );
}



function HotelCard({
  hotel,
  onSelect,
  onViewDetails,
}: {
  hotel: Hotel;

  onSelect: (
    hotel: Hotel,
    room: HotelRoom,
    rate: HotelRate,
  ) => void;

  onViewDetails: (hotelId: string) => void;
}) {
  return (
    <article className="hotel-card">
      <div className="hotel-header">
        {hotel.image ? (
          <img
            className="hotel-image"
            src={hotel.image}
            alt={hotel.name}
            loading="lazy"
          />
        ) : (
          <div className="hotel-image hotel-image-placeholder">
            No image available
          </div>
        )}

        <div className="hotel-details">
          <div className="hotel-title-row">
            <h3>{hotel.name}</h3>

            {hotel.stars != null &&
              hotel.stars > 0 && (
                <span className="stars">
                  {'★'.repeat(
                    Math.min(hotel.stars, 5),
                  )}
                </span>
              )}
          </div>

          <p className="address">
            {hotel.address ?? hotel.city ?? 'Canada'}
          </p>

          {hotel.rating != null && (
            <div className="rating">
              <strong>{hotel.rating}</strong>
              <span>Guest rating</span>
            </div>
          )}

          <button
            type="button"
            className="secondary-button"
            onClick={() =>
              onViewDetails(hotel.hotelId)
            }
          >
            View Hotel Details
          </button>
        </div>
      </div>

      <div className="rooms">
        {hotel.rooms.map((room) =>
          room.rates.map((rate, index) => (
            <div
              className="room-card"
              key={
                rate.rateId ??
                `${room.offerId}-${rate.name ?? index}`
              }
            >
              <div className="room-info">
                <h4>
                  {room.name ??
                    rate.name ??
                    'Available Room'}
                </h4>

                <div className="room-meta">
                  {rate.boardName && (
                    <span>{rate.boardName}</span>
                  )}

                  {rate.adultCount != null && (
                    <span>
                      {rate.adultCount} adults
                    </span>
                  )}

                  {rate.cancellation?.refundable && (
                    <span className="refundable">
                      Refundable
                    </span>
                  )}
                </div>

                {rate.perks?.length > 0 && (
                  <div className="perks">
                    {rate.perks
                      .slice(0, 2)
                      .map((perk, perkIndex) => (
                        <span key={perkIndex}>
                          ✓ {perk.name}
                        </span>
                      ))}
                  </div>
                )}
              </div>

              <div className="room-price">
                <small>Total</small>

                <strong>
                  {rate.price
                    ? `${rate.price.currency} ${rate.price.amount.toFixed(2)}`
                    : 'Price unavailable'}
                </strong>

                <button
                  type="button"
                  className="secondary-button"
                  disabled={!rate.price}
                  onClick={() =>
                    onSelect(hotel, room, rate)
                  }
                >
                  Select Room
                </button>
              </div>
            </div>
          )),
        )}
      </div>
    </article>
  );
}