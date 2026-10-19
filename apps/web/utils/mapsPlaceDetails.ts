import { gql } from 'graphql-request'
import { gqlClient, graphQLClientRequestWithRetry } from './graphql'

export type MapsPlaceDetails = {
    placeId: string | null
    name: string | null
    address: string | null
    category: string | null
    postalCode: string | null
    prefecture: string | null
    city: string | null
    street: string | null
    latitude: number | null
    longitude: number | null
}

const mapsPlacePreviewQuery = gql`
    query MapsPlacePreview($url: String!, $languageCode: String) {
        mapsPlacePreview(url: $url, languageCode: $languageCode) {
            placeId
            name
            address
            category
            postalCode
            prefecture
            city
            street
            latitude
            longitude
        }
    }
`

type MapsPlacePreviewResponse = {
    mapsPlacePreview?: {
        placeId?: string | null
        name?: string | null
        address?: string | null
        category?: string | null
        postalCode?: string | null
        prefecture?: string | null
        city?: string | null
        street?: string | null
        latitude?: number | null
        longitude?: number | null
    } | null
}

/** One Places read for a Maps URL. A failure is not retried. Nothing returned here is saved. */
export async function fetchMapsPlaceDetails(
    url: string,
    languageCode: 'ja' | 'en'
): Promise<MapsPlaceDetails | null> {
    const response = await graphQLClientRequestWithRetry<MapsPlacePreviewResponse>(
        gqlClient.request.bind(gqlClient),
        mapsPlacePreviewQuery,
        { url, languageCode },
        { skipAuth: true, retryAmount: 0, abortAfterMs: 8000 }
    )

    const place = response.data?.mapsPlacePreview
    if (response.hasErrors || !place) return null

    return {
        placeId: place.placeId ?? null,
        name: place.name ?? null,
        address: place.address ?? null,
        category: place.category ?? null,
        postalCode: place.postalCode ?? null,
        prefecture: place.prefecture ?? null,
        city: place.city ?? null,
        street: place.street ?? null,
        latitude: place.latitude ?? null,
        longitude: place.longitude ?? null
    }
}
