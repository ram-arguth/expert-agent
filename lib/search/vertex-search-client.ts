import { v1 } from '@google-cloud/discoveryengine';

/**
 * Vertex AI Search Client (Discovery Engine)
 * 
 * Handles searching against an enterprise data store.
 * Supports mock mode for testing/development without GCP credentials.
 */

// Interface for search results
export interface SearchResult {
  title: string;
  snippet: string;
  link?: string;
  source?: string;
}

// Client options
interface SearchOptions {
  query: string;
  dataStoreId: string; // Full resource name or just ID
  pageSize?: number;
}

/**
 * Search the data store for relevant documents.
 */
export async function searchDataStore(options: SearchOptions): Promise<SearchResult[]> {
  const { query, dataStoreId, pageSize = 5 } = options;

  // Mock mode check
  if (process.env.VERTEX_SEARCH_MOCK === 'true' || process.env.NODE_ENV === 'test') {
    return getMockResults(query);
  }

  try {
    // Determine project and location from env or defaults
    const projectId = process.env.GCP_PROJECT_ID || 'expert-ai-dev';
    const location = 'global'; // Vertex AI Search is typically global or specific region
    
    // Construct full resource name if only ID provided
    // Pattern: projects/{project}/locations/{location}/collections/{collection}/dataStores/{data_store_id}
    // For simplicity, we assume the dataStoreId passed is the full resource ID or we build it
    // But typically the client just needs the serving config.
    // Let's assume dataStoreId passed is the ID, and we use 'default_search' serving config.
    
    // Actually, the client instantiation needs to know the endpoint/location
    const client = new v1.SearchServiceClient();

    // The serving config resource name
    // projects/{project}/locations/{location}/collections/default_collection/dataStores/{data_store_id}/servingConfigs/default_search
    // We allow passing the full string or constructing it
    const servingConfig = dataStoreId.includes('/') 
      ? dataStoreId 
      : client.projectLocationCollectionDataStoreServingConfigPath(
          projectId,
          location,
          'default_collection',
          dataStoreId,
          'default_search'
        );

    const request = {
      servingConfig,
      query,
      pageSize,
      queryExpansionSpec: { condition: 'AUTO' },
      spellCorrectionSpec: { mode: 'AUTO' },
    };

    const [response] = await client.search(request);

    if (!response.results) {
      return [];
    }

    return response.results.map(result => {
      const doc = result.document;
      const derived = doc?.derivedStructData;
      
      // Extract snippet and title
      // Structure depends on how data was indexed (unstructured vs structured)
      // Common pattern for unstructured:
      const title = derived?.title || doc?.id || 'Unknown Document';
      const snippet = derived?.snippets?.[0]?.snippet || derived?.extractive_segments?.[0]?.content || '';
      const link = derived?.link || (doc?.derivedStructData as any)?.link || '';
      
      return {
        title: String(title),
        snippet: String(snippet),
        link: String(link),
        source: doc?.name || '',
      };
    });

  } catch (error) {
    console.error('Vertex AI Search error:', error);
    // Fallback to empty results rather than crashing query flow
    return [];
  }
}

/**
 * Mock results for testing
 */
function getMockResults(query: string): SearchResult[] {
  return [
    {
      title: 'Company Policy v2.pdf',
      snippet: `...relevant section matching "${query}". This policy states that all employees must...`,
      source: 'gs://bucket/company-policy-v2.pdf',
    },
    {
      title: 'Technical Manual',
      snippet: `...procedure for "${query}" involves three steps: 1. Initialize...`,
      source: 'gs://bucket/manual.pdf',
    },
  ];
}
