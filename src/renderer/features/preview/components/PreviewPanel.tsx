export const PreviewPanel = () => {
  return (
    <>
      <div className="panel">
        <header className="panel-header">
          <span className="panel-title">Preview</span>
        </header>

        <div className="panel-content">
          <div className="placeholder">
            <strong>Markdown Preview</strong>
            <span>Rendered document</span>
          </div>
        </div>
      </div>
    </>
  );
};
