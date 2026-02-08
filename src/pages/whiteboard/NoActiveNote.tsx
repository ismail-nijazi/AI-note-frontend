import React from "react";

interface NoActiveNoteProps {
  handleCreateNote: () => void;
  handleCreateCollection: () => void;
}

const NoActiveNote: React.FC<NoActiveNoteProps> = ({
  handleCreateNote,
  handleCreateCollection,
}) => {
  return (
    <div className="flex-1 flex items-center justify-center bg-gradient-to-br from-background to-muted relative">
      <div className="text-center max-w-3xl mx-auto px-8">
        <div className="flex items-center justify-center mb-10">
          <div className="h-24 w-24 bg-gradient-to-br from-primary/20 to-primary/5 rounded-3xl flex items-center justify-center shadow-lg">
            <svg
              className="h-12 w-12 text-primary"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.746 0 3.332.477 4.5 1.253v13C19.832 18.477 18.246 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"
              />
            </svg>
          </div>
        </div>
        <h1 className="text-4xl font-bold mb-6 bg-gradient-to-r from-primary via-primary/80 to-primary/60 bg-clip-text text-transparent">
          Welcome to Your Workspace
        </h1>
        <p className="text-xl text-muted-foreground mb-12 leading-relaxed max-w-2xl mx-auto">
          Select a note from the sidebar to start editing, or create a new note
          to begin organizing your thoughts on the infinite canvas.
        </p>

        {/* Quick Actions */}
        <div className="grid md:grid-cols-2 gap-6 mb-12 max-w-2xl mx-auto">
          <button
            onClick={handleCreateNote}
            className="group p-6 rounded-2xl border border-border/50 bg-card/50 hover:bg-card hover:border-primary/30 transition-all duration-300 hover:shadow-lg"
          >
            <div className="flex items-center justify-center mb-4">
              <div className="h-12 w-12 bg-primary/10 rounded-xl flex items-center justify-center group-hover:bg-primary/20 transition-colors">
                <svg
                  className="h-6 w-6 text-primary"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 6v6m0 0v6m0-6h6m-6 0H6"
                  />
                </svg>
              </div>
            </div>
            <h3 className="text-lg font-semibold mb-2 group-hover:text-primary transition-colors">
              Create New Note
            </h3>
            <p className="text-sm text-muted-foreground">
              Start a new note and begin organizing your thoughts
            </p>
          </button>

          <button
            onClick={handleCreateCollection}
            className="group p-6 rounded-2xl border border-border/50 bg-card/50 hover:bg-card hover:border-primary/30 transition-all duration-300 hover:shadow-lg"
          >
            <div className="flex items-center justify-center mb-4">
              <div className="h-12 w-12 bg-primary/10 rounded-xl flex items-center justify-center group-hover:bg-primary/20 transition-colors">
                <svg
                  className="h-6 w-6 text-primary"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"
                  />
                </svg>
              </div>
            </div>
            <h3 className="text-lg font-semibold mb-2 group-hover:text-primary transition-colors">
              Create Collection
            </h3>
            <p className="text-sm text-muted-foreground">
              Organize your notes into collections for better structure
            </p>
          </button>
        </div>
      </div>
    </div>
  );
};

export default NoActiveNote;
