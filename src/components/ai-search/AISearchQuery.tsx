import { useState, useCallback, type JSX, type FormEvent } from "react";
import { api } from "../../services/api";
import type { AISearchResponse, AISearchResult } from "../../services/api";

interface AISearchQueryProps {
  instanceName: string;
  onBack: () => void;
}

type SearchMode = "semantic" | "ai";

export function AISearchQuery({
  instanceName,
  onBack,
}: AISearchQueryProps): JSX.Element {
  const [query, setQuery] = useState("");
  const [searchMode, setSearchMode] = useState<SearchMode>("ai");
  const [isSearching, setIsSearching] = useState(false);
  const [results, setResults] = useState<AISearchResult[]>([]);
  const [aiResponse, setAiResponse] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [maxResults, setMaxResults] = useState(10);

  const handleSearch = useCallback(
    async (e: FormEvent) => {
      e.preventDefault();
      if (!query.trim()) return;

      setIsSearching(true);
      setError(null);
      setResults([]);
      setAiResponse(null);

      try {
        let response: AISearchResponse;

        if (searchMode === "ai") {
          response = await api.aiSearch(instanceName, {
            query: query.trim(),
            max_num_results: maxResults,
            rewrite_query: true,
          });
          setAiResponse(response.response ?? null);
        } else {
          response = await api.semanticSearch(instanceName, {
            query: query.trim(),
            max_num_results: maxResults,
            rewrite_query: false,
          });
        }

        setResults(response.data ?? []);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Search failed");
      } finally {
        setIsSearching(false);
      }
    },
    [query, searchMode, instanceName, maxResults],
  );

  return (
    <div className="ai-search-query">
      <div className="ai-search-query-header">
        <button className="ai-search-back-btn" onClick={onBack}>
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <polyline points="15 18 9 12 15 6" />
          </svg>
          Back
        </button>
        <h3>Query: {instanceName}</h3>
      </div>

      <form className="ai-search-form" onSubmit={handleSearch}>
        <div className="ai-search-mode-toggle">
          <button
            type="button"
            className={`mode-btn ${searchMode === "ai" ? "active" : ""}`}
            onClick={() => setSearchMode("ai")}
          >
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <path d="M12 2a2 2 0 0 1 2 2c0 .74-.4 1.39-1 1.73V7h1a7 7 0 0 1 7 7h1a1 1 0 0 1 1 1v3a1 1 0 0 1-1 1h-1v1a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-1H2a1 1 0 0 1-1-1v-3a1 1 0 0 1 1-1h1a7 7 0 0 1 7-7h1V5.73c-.6-.34-1-.99-1-1.73a2 2 0 0 1 2-2M7.5 13a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3m9 0a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3" />
            </svg>
            AI Search
          </button>
          <button
            type="button"
            className={`mode-btn ${searchMode === "semantic" ? "active" : ""}`}
            onClick={() => setSearchMode("semantic")}
          >
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <circle cx="11" cy="11" r="8" />
              <path d="m21 21-4.35-4.35" />
            </svg>
            Semantic Search
          </button>
        </div>

        <div className="ai-search-input-row">
          <input
            type="text"
            id="ai-search-query"
            name="ai-search-query"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={
              searchMode === "ai"
                ? "Ask a question about your data..."
                : "Search for relevant content..."
            }
            className="ai-search-input"
            disabled={isSearching}
          />
          <button
            type="submit"
            className="ai-search-submit-btn"
            disabled={isSearching || !query.trim()}
          >
            {isSearching ? (
              <div className="ai-search-spinner small" />
            ) : (
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <circle cx="11" cy="11" r="8" />
                <path d="m21 21-4.35-4.35" />
              </svg>
            )}
          </button>
        </div>

        <div className="ai-search-options">
          <label className="ai-search-option">
            <span>Max Results:</span>
            <select
              id="ai-search-max-results"
              name="ai-search-max-results"
              value={maxResults}
              onChange={(e) => setMaxResults(Number(e.target.value))}
              disabled={isSearching}
            >
              <option value={5}>5</option>
              <option value={10}>10</option>
              <option value={20}>20</option>
              <option value={50}>50</option>
            </select>
          </label>
        </div>
      </form>

      {error && (
        <div className="ai-search-error">
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <circle cx="12" cy="12" r="10" />
            <path d="M12 8v4M12 16h.01" />
          </svg>
          <span>{error}</span>
        </div>
      )}

      {aiResponse && (
        <div className="ai-search-ai-response">
          <h4>
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <path d="M12 2a2 2 0 0 1 2 2c0 .74-.4 1.39-1 1.73V7h1a7 7 0 0 1 7 7h1a1 1 0 0 1 1 1v3a1 1 0 0 1-1 1h-1v1a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-1H2a1 1 0 0 1-1-1v-3a1 1 0 0 1 1-1h1a7 7 0 0 1 7-7h1V5.73c-.6-.34-1-.99-1-1.73a2 2 0 0 1 2-2M7.5 13a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3m9 0a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3" />
            </svg>
            AI Response
          </h4>
          <p>{aiResponse}</p>
        </div>
      )}

      {results.length > 0 && (
        <div className="ai-search-results">
          <h4>
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
              <polyline points="14 2 14 8 20 8" />
            </svg>
            Sources ({results.length})
          </h4>
          <div className="ai-search-results-list">
            {results.map((result) => (
              <div key={result.file_id} className="ai-search-result-card">
                <div className="ai-search-result-header">
                  <span className="result-filename">{result.filename}</span>
                  <span className="result-score">
                    {(result.score * 100).toFixed(1)}% match
                  </span>
                </div>
                {result.content.map((content) => (
                  <div key={content.id} className="ai-search-result-content">
                    <p>{content.text}</p>
                  </div>
                ))}
                {result.attributes?.folder && (
                  <div className="ai-search-result-meta">
                    <span className="result-folder">
                      📁 {result.attributes.folder}
                    </span>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {!isSearching && !error && results.length === 0 && query && (
        <div className="ai-search-no-results">
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <circle cx="11" cy="11" r="8" />
            <path d="m21 21-4.35-4.35" />
            <path d="M8 11h6" />
          </svg>
          <p>No results found for your query.</p>
        </div>
      )}
    </div>
  );
}
