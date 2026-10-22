import {
  BookApiResponse,
  HotelCitiesResponse,
  HotelDetailResponse,
  HotelSearchResponse,
  PrebookApiResponse,
  SearchApiResponse,
} from '@/types/hotel';

// const API_URL = "http://localhost:8000/api/v2/hotel"
const API_URL = "https://instant-rebook-server.onrender.com/api/v2/hotel"

if (!API_URL) {
  throw new Error(
    'NEXT_PUBLIC_HOTEL_API_URL is not configured',
  );
}

async function request<T>(
  url: string,
  options?: RequestInit,
): Promise<T> {
  const response = await fetch(
    url,
    {
      ...options,

      headers: {
        'Content-Type':
          'application/json',

        ...(options?.headers ?? {}),
      },

      cache: 'no-store',
    },
  );

  const data =
    await response.json().catch(
      () => null,
    );

  if (!response.ok) {
    throw new Error(
      data?.message ??
        data?.error ??
        'Something went wrong',
    );
  }

  return data;
}

export async function searchHotels(
  params: URLSearchParams,
) {
  return request<SearchApiResponse>(
    `${API_URL}/search?${params.toString()}`,
  );
}

export async function prebookHotel(
  offerId: string,
) {
  return request<PrebookApiResponse>(
    `${API_URL}/prebook`,
    {
      method: 'POST',

      body: JSON.stringify({
        offerId,

        usePaymentSdk: true,
      }),
    },
  );
}

export async function sendBookingLink(
  email: string,
  link: string,
) {
  return request<{
    success: boolean;
    data: {
      message: string;
    };
  }>(
    `${API_URL}/send-link`,
    {
      method: 'POST',

      body: JSON.stringify({
        email,
        link,
      }),
    },
  );
}

export async function bookHotel(
  payload: unknown,
) {
  return request<BookApiResponse>(
    `${API_URL}/book`,
    {
      method: 'POST',

      body: JSON.stringify(payload),
    },
  );
}



// export async function getHotelCities(
//   countryCode = 'CA',
// ): Promise<HotelCitiesResponse> {
//   const params = new URLSearchParams({
//     countryCode,
//   });

//   const response = await fetch(
//     `${API_URL}/cities?${params.toString()}`,
//   );

//   const result =
//     (await response.json()) as HotelCitiesResponse;

//   if (!response.ok || !result.success) {
//     throw new Error('Unable to fetch cities');
//   }

//   return result;
// }


export async function getHotelCities(
  countryCode = 'CA',
): Promise<HotelCitiesResponse> {
  const params = new URLSearchParams({
    countryCode,
  });

  const url = `${API_URL}/cities?${params.toString()}`;

  const response = await fetch(url, {
    method: 'GET',
    headers: {
      Accept: 'application/json',
    },
    cache: 'no-store',
  });

  const result = await response.json().catch(() => null);

  if (!response.ok) {
    console.error('Get hotel cities failed:', {
      url,
      status: response.status,
      result,
    });

    throw new Error(
      result?.message ??
        result?.error ??
        `Unable to fetch cities (HTTP ${response.status})`,
    );
  }

  if (!result?.success) {
    console.error('Invalid cities API response:', result);

    throw new Error(
      result?.message ??
        'The cities API returned an unsuccessful response',
    );
  }

  return result as HotelCitiesResponse;
}


export async function getHotelDetails(
  hotelId: string,
): Promise<HotelDetailResponse> {
 
  const response = await fetch(
    `${API_URL}/hotel-deatil/${encodeURIComponent(hotelId)}`,
  );

  const result =
    (await response.json()) as HotelDetailResponse;

  if (!response.ok || !result.success) {
    throw new Error(
      'Unable to fetch hotel details',
    );
  }

  return result;
}