import { useState } from 'react';
import axios from 'axios';

function SemanticSearch() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);

  const handleSearch = async (e) => {
    e.preventDefault();
    try {
      const response = await axios.get('/api/semantic-search', { params: { q: query } });
      setResults(response.data);
    } catch (error) {
      console.error('Error during search:', error);
    }
  };

  return (
    <div>
      <form onSubmit={handleSearch}>
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search for a rental..."
        />
        <button type="submit">Search</button>
      </form>
      <ul>
        {results.map((post) => (
          <li key={post.id}>{post.title} - {post.price}₫</li>
        ))}
      </ul>
    </div>
  );
}

export default SemanticSearch;
