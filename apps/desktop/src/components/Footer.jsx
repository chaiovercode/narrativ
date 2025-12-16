import { Link } from 'react-router-dom';

export function Footer() {
  return (
    <footer className="app-footer">
      <div className="footer-container">
        <div className="footer-top">
          <div className="footer-brand">
            <span className="footer-logo">✦ Revelio</span>
            <p className="footer-tagline">Transform ideas into visual stories</p>
          </div>

          <div className="footer-links">
            <div className="footer-column">
              <h4>Navigate</h4>
              <Link to="/">Home</Link>
              <Link to="/create">Create</Link>
              <Link to="/gallery">Gallery</Link>
            </div>
            <div className="footer-column">
              <h4>Create</h4>
              <Link to="/create">New Story</Link>
              <Link to="/gallery">View Stories</Link>
            </div>
          </div>
        </div>

        <div className="footer-bottom">
          <p>&copy; {new Date().getFullYear()} Revelio. Crafted with AI magic.</p>
        </div>
      </div>
    </footer>
  );
}
