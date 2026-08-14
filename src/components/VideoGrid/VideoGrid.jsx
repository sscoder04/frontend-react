import VideoTile from "../VideoTile/VideoTile.jsx";
import "./VideoGrid.css";

export default function VideoGrid({ localTile, participants }) {
  const tiles = [localTile, ...participants];
  const count = tiles.length;

  return (
    <div className="video-grid" data-count={Math.min(count, 9)}>
      {tiles.map((tile) => (
        <div className="video-grid__cell" key={tile.id}>
          <VideoTile {...tile} />
        </div>
      ))}
    </div>
  );
}
