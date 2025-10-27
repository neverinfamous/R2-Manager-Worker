// Search type definitions

export interface SearchResult {
  key: string;
  bucket: string;
  size: number;
  uploaded: string;
  url: string;
}

export interface SearchFilters {
  query: string;
  extensions: string[];
  minSize: number | null;
  maxSize: number | null;
  startDate: Date | null;
  endDate: Date | null;
}

export interface SearchResponse {
  results: SearchResult[];
  pagination: {
    total: number;
    hasMore: boolean;
  };
}

export type SortColumn = 'filename' | 'bucket' | 'size' | 'uploaded';
export type SortDirection = 'asc' | 'desc';

export interface SearchState {
  filters: SearchFilters;
  results: SearchResult[];
  isSearching: boolean;
  error: string | null;
  sortColumn: SortColumn;
  sortDirection: SortDirection;
  total: number;
  hasMore: boolean;
}

