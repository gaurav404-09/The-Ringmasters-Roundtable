"""
Unit tests for the RAG retriever module.

Tests:
  1. Metadata filter construction — city isolation, optional category filter
  2. _format_context             — output format structure
  3. Fallback when similarity_search returns empty results
  4. ensure_city_knowledge       — cache hit returns immediately (no generation)

All ChromaDB, Cohere, and ingest calls are mocked.
"""
import sys
import os
import pytest
from unittest.mock import patch, MagicMock
from langchain_core.documents import Document

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))


# ---------------------------------------------------------------------------
# _format_context
# ---------------------------------------------------------------------------

class TestFormatContext:
    """Tests for the context formatter that prepares retrieved chunks for LLM injection."""

    def setup_method(self):
        from rag.retriever import _format_context
        self.fmt = _format_context

    def test_includes_city_header(self):
        docs = [Document(page_content="Goa has beaches.", metadata={"category": "attractions"})]
        output = self.fmt("Goa", docs)
        assert "Goa" in output

    def test_includes_category_label(self):
        docs = [Document(page_content="Calangute Beach.", metadata={"category": "attractions"})]
        output = self.fmt("Goa", docs)
        assert "attractions" in output

    def test_includes_source_numbering(self):
        docs = [
            Document(page_content="Beach 1", metadata={"category": "attractions"}),
            Document(page_content="Restaurant 1", metadata={"category": "food"}),
        ]
        output = self.fmt("Goa", docs)
        assert "Source 1" in output
        assert "Source 2" in output

    def test_includes_page_content(self):
        docs = [Document(page_content="Specific restaurant: Fisherman's Wharf", metadata={"category": "food"})]
        output = self.fmt("Goa", docs)
        assert "Fisherman's Wharf" in output

    def test_returns_no_info_message_on_empty_docs(self):
        output = self.fmt("Goa", [])
        assert "No relevant information" in output

    def test_handles_missing_category_metadata_gracefully(self):
        """Chunks without a category key should default to 'general'."""
        docs = [Document(page_content="Some info.", metadata={})]
        output = self.fmt("Goa", docs)
        assert "general" in output


# ---------------------------------------------------------------------------
# Metadata filter construction
# ---------------------------------------------------------------------------

class TestMetadataFilterConstruction:
    """
    Tests that retrieve_destination_context builds correct ChromaDB filters.
    We mock the vector store and verify the filter argument passed to
    similarity_search.
    """

    @patch("rag.retriever.get_vector_store")
    @patch("rag.retriever.ensure_city_knowledge")
    def test_city_only_filter_when_no_category(self, mock_ensure, mock_get_store, mock_chroma_store):
        from rag.retriever import retrieve_destination_context
        mock_get_store.return_value = mock_chroma_store
        mock_ensure.return_value = {"city": "goa", "status": "cache_hit"}

        retrieve_destination_context(city="Goa", query="top attractions", top_k=2, use_rerank=False)

        call_kwargs = mock_chroma_store.similarity_search.call_args
        assert call_kwargs[1]["filter"] == {"city": "goa"}

    @patch("rag.retriever.get_vector_store")
    @patch("rag.retriever.ensure_city_knowledge")
    def test_and_filter_when_category_provided(self, mock_ensure, mock_get_store, mock_chroma_store):
        from rag.retriever import retrieve_destination_context
        mock_get_store.return_value = mock_chroma_store
        mock_ensure.return_value = {"city": "goa", "status": "cache_hit"}

        retrieve_destination_context(
            city="Goa", query="food", category="food", top_k=2, use_rerank=False
        )

        call_kwargs = mock_chroma_store.similarity_search.call_args
        filt = call_kwargs[1]["filter"]
        # Should use $and operator to combine city + category
        assert "$and" in filt or ("city" in filt and "category" in filt)

    @patch("rag.retriever.get_vector_store")
    @patch("rag.retriever.ensure_city_knowledge")
    def test_city_is_lowercased_in_filter(self, mock_ensure, mock_get_store, mock_chroma_store):
        from rag.retriever import retrieve_destination_context
        mock_get_store.return_value = mock_chroma_store
        mock_ensure.return_value = {"city": "jaipur", "status": "cache_hit"}

        retrieve_destination_context(city="Jaipur", query="forts", top_k=2, use_rerank=False)

        call_kwargs = mock_chroma_store.similarity_search.call_args
        filt = call_kwargs[1]["filter"]
        assert "jaipur" in str(filt)


# ---------------------------------------------------------------------------
# Fallback on empty search results
# ---------------------------------------------------------------------------

class TestEmptySearchFallback:
    """Tests that retriever handles empty vector store results gracefully."""

    @patch("rag.retriever.get_vector_store")
    @patch("rag.retriever.ensure_city_knowledge")
    def test_returns_no_relevant_info_when_empty(self, mock_ensure, mock_get_store):
        from rag.retriever import retrieve_destination_context
        store = MagicMock()
        store.similarity_search.return_value = []
        mock_get_store.return_value = store
        mock_ensure.return_value = {"city": "goa", "status": "cache_hit"}

        result = retrieve_destination_context(city="Goa", query="anything", top_k=5, use_rerank=False)
        assert "No relevant information" in result


# ---------------------------------------------------------------------------
# ensure_city_knowledge cache hit
# ---------------------------------------------------------------------------

class TestEnsureCityKnowledge:
    """Tests for the self-populating knowledge base logic."""

    @patch("rag.ingest.collection_has_city", return_value=True)
    def test_cache_hit_skips_generation(self, mock_has_city):
        """
        If the city is already in ChromaDB, ensure_city_knowledge should
        return immediately without calling Cohere.
        """
        from rag.ingest import ensure_city_knowledge

        with patch("rag.ingest.generate_destination_knowledge") as mock_gen:
            result = ensure_city_knowledge("Goa")
            mock_gen.assert_not_called()

        assert result["status"] == "cache_hit"
        assert result["city"] == "Goa"

    @patch("rag.ingest.collection_has_city", return_value=False)
    @patch("rag.ingest.chunk_and_embed", return_value=15)
    @patch("rag.ingest.generate_destination_knowledge", return_value="Rich Goa travel guide content...")
    def test_cache_miss_triggers_generation(self, mock_gen, mock_chunk, mock_has):
        """
        If the city is NOT in ChromaDB, ensure_city_knowledge should
        generate content and store it.
        """
        from rag.ingest import ensure_city_knowledge

        result = ensure_city_knowledge("Goa")

        mock_gen.assert_called_once_with("Goa")
        mock_chunk.assert_called_once()
        assert result["status"] == "generated"
        assert result["chunks_count"] == 15
