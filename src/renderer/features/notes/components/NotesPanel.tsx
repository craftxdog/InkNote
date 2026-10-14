export const NotesPanel = () => {
  return (
    <>
      <div className="panel">
        <header className="panel-header">
          <span className="panel-title">All notes</span>
        </header>
        <div className="panel-content">
          <div className="placeholder">
            <strong className="text-lg font-semibold text-zinc-900">
              Notes
            </strong>
            <span> Search and note explore</span>
          </div>
        </div>
      </div>
    </>
  );
};
