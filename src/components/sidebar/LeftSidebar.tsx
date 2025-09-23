import React, { useState } from 'react';
import { 
  FolderPlus, 
  Search, 
  MoreHorizontal, 
  Plus, 
  Edit, 
  Copy, 
  Trash2,
  ChevronDown,
  ChevronRight,
  FileText,
  Download,
  Upload,
  PanelLeftClose
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Separator } from '@/components/ui/separator';
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuTrigger 
} from '@/components/ui/dropdown-menu';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { useWorkspaceStore } from '@/state/useWorkspaceStore';
import { useBoardStore } from '@/state/useBoardStore';

interface LeftSidebarProps {
  width: number;
  onResize: (width: number) => void;
}

export const LeftSidebar: React.FC<LeftSidebarProps> = ({ width, onResize }) => {
  const {
    workspace,
    searchQuery,
    setSearchQuery,
    createCollection,
    updateCollection,
    deleteCollection,
    createNote,
    updateNote,
    deleteNote,
    duplicateNote,
    setActiveNote,
    getCurrentNote,
    exportWorkspace,
    importWorkspace,
    toggleLeftSidebar,
  } = useWorkspaceStore();

  const { 
    loadNote,
    clearBoard,
    noteBoxes,
    canvasTransform
  } = useBoardStore();

  const [editingCollection, setEditingCollection] = useState<string | null>(null);
  const [editingNote, setEditingNote] = useState<string | null>(null);
  const [expandedCollections, setExpandedCollections] = useState<Set<string>>(new Set());

  // Save current board state when switching notes
  const saveCurrentNoteState = () => {
    const currentNote = getCurrentNote();
    if (currentNote && workspace.active.collectionId && workspace.active.noteId) {
      updateNote(workspace.active.collectionId, workspace.active.noteId, {
        boxes: noteBoxes.map(box => ({
          id: box.id,
          x: box.x,
          y: box.y,
          width: box.width,
          height: box.height,
          zIndex: box.zIndex,
          content: box.content,
        })),
        zoom: canvasTransform.scale,
        pan: { x: canvasTransform.x, y: canvasTransform.y },
      });
    }
  };

  const handleNoteSelect = (collectionId: string, noteId: string) => {
    if (workspace.active.noteId === noteId) return;
    
    // Save current state first
    saveCurrentNoteState();
    
    // Load new note
    const note = workspace.collections[collectionId]?.notes[noteId];
    if (note) {
      // Load note data into board
      loadNote(note.boxes, {
        scale: note.zoom,
        x: note.pan.x,
        y: note.pan.y,
      });
      
      // Set as active
      setActiveNote(collectionId, noteId);
    }
  };

  const handleCreateCollection = () => {
    const title = prompt('Collection name:');
    if (title?.trim()) {
      createCollection(title.trim());
    }
  };

  const handleCreateNote = (collectionId: string) => {
    const title = prompt('Note name:');
    if (title?.trim()) {
      const noteId = createNote(collectionId, title.trim());
      handleNoteSelect(collectionId, noteId);
    }
  };

  const handleRenameCollection = (id: string, currentTitle: string) => {
    const newTitle = prompt('Rename collection:', currentTitle);
    if (newTitle?.trim() && newTitle !== currentTitle) {
      updateCollection(id, { title: newTitle.trim() });
    }
  };

  const handleRenameNote = (collectionId: string, noteId: string, currentTitle: string) => {
    const newTitle = prompt('Rename note:', currentTitle);
    if (newTitle?.trim() && newTitle !== currentTitle) {
      updateNote(collectionId, noteId, { title: newTitle.trim() });
    }
  };

  const handleDeleteCollection = (id: string, title: string) => {
    if (confirm(`Delete collection "${title}" and all its notes?`)) {
      deleteCollection(id);
    }
  };

  const handleDeleteNote = (collectionId: string, noteId: string, title: string) => {
    if (confirm(`Delete note "${title}"?`)) {
      deleteNote(collectionId, noteId);
    }
  };

  const handleExport = () => {
    try {
      const data = exportWorkspace();
      const blob = new Blob([data], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `whiteboard-workspace-${new Date().toISOString().split('T')[0]}.json`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      alert('Failed to export workspace');
    }
  };

  const handleImport = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (file) {
        const reader = new FileReader();
        reader.onload = (e) => {
          try {
            const data = e.target?.result as string;
            importWorkspace(data);
            alert('Workspace imported successfully');
          } catch (error) {
            alert('Failed to import workspace');
          }
        };
        reader.readAsText(file);
      }
    };
    input.click();
  };

  const toggleCollection = (id: string) => {
    setExpandedCollections(prev => {
      const newSet = new Set(prev);
      if (newSet.has(id)) {
        newSet.delete(id);
      } else {
        newSet.add(id);
      }
      return newSet;
    });
  };

  const filteredCollections = workspace.collectionOrder
    .map(id => workspace.collections[id])
    .filter(collection => {
      if (!searchQuery) return true;
      const query = searchQuery.toLowerCase();
      return collection.title.toLowerCase().includes(query) ||
        Object.values(collection.notes).some(note => 
          note.title.toLowerCase().includes(query)
        );
    });

  return (
    <div 
      className="flex flex-col h-full bg-background border-r border-border"
      style={{ width }}
    >
      {/* Header */}
      <div className="p-4">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-medium text-muted-foreground">Collections</h2>
          <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={handleCreateCollection}>
            <Plus className="h-3 w-3" />
          </Button>
        </div>
        
        <Button 
          className="w-full mb-4 bg-primary hover:bg-primary/90"
          onClick={() => {
            if (filteredCollections.length > 0) {
              handleCreateNote(filteredCollections[0].id);
            } else {
              handleCreateCollection();
            }
          }}
        >
          <Plus className="mr-2 h-4 w-4" />
          New Note
        </Button>
        
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search notes..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10 h-8 text-sm"
          />
        </div>
      </div>

      {/* Quick Access */}
      <div className="px-4 mb-4">
        <h3 className="text-sm font-medium text-muted-foreground mb-2">Quick Access</h3>
        <div className="space-y-1">
          <div className="flex items-center justify-between p-2 hover:bg-accent rounded-md cursor-pointer">
            <div className="flex items-center">
              <FileText className="mr-3 h-4 w-4 text-muted-foreground" />
              <span className="text-sm">All Notes</span>
            </div>
            <span className="text-xs text-muted-foreground">
              {filteredCollections.reduce((total, col) => total + Object.keys(col.notes).length, 0)}
            </span>
          </div>
        </div>
      </div>

      {/* Collections & Notes */}
      <div className="flex-1 overflow-auto">
        <div className="px-4 space-y-4">
          {/* Collections */}
          <div>
            <h3 className="text-sm font-medium text-muted-foreground mb-2">Collections</h3>
            {filteredCollections.length === 0 ? (
              <div className="text-center py-8">
                <p className="text-muted-foreground mb-4">No collections yet</p>
                <Button 
                  variant="outline" 
                  onClick={handleCreateCollection}
                  className="mx-auto"
                >
                  <Plus className="mr-2 h-4 w-4" />
                  Create Collection
                </Button>
              </div>
            ) : (
              <div className="space-y-1">
                {filteredCollections.map((collection) => {
                  const isExpanded = expandedCollections.has(collection.id);
                  const notes = collection.noteOrder
                    .map(id => collection.notes[id])
                    .filter(note => note && (
                      searchQuery === '' || 
                      note.title.toLowerCase().includes(searchQuery.toLowerCase())
                    ));

                  return (
                    <Collapsible
                      key={collection.id}
                      open={isExpanded}
                      onOpenChange={() => toggleCollection(collection.id)}
                    >
                      <div className="flex items-center group">
                        <CollapsibleTrigger className="flex items-center flex-1 p-2 hover:bg-accent rounded-md text-left">
                          <div className="w-3 h-3 rounded-full bg-primary mr-3"></div>
                          <span className="flex-1 text-sm">{collection.title}</span>
                          <span className="text-xs text-muted-foreground ml-2">
                            {Object.keys(collection.notes).length}
                          </span>
                        </CollapsibleTrigger>
                        
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button 
                              variant="ghost" 
                              size="sm" 
                              className="opacity-0 group-hover:opacity-100 h-6 w-6 p-0"
                            >
                              <MoreHorizontal className="h-3 w-3" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => handleCreateNote(collection.id)}>
                              <Plus className="mr-2 h-4 w-4" />
                              Add Note
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => handleRenameCollection(collection.id, collection.title)}>
                              <Edit className="mr-2 h-4 w-4" />
                              Rename
                            </DropdownMenuItem>
                            <DropdownMenuItem 
                              onClick={() => handleDeleteCollection(collection.id, collection.title)}
                              className="text-destructive"
                            >
                              <Trash2 className="mr-2 h-4 w-4" />
                              Delete
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>

                      <CollapsibleContent>
                        <div className="ml-6 space-y-1 pt-1">
                          {notes.map((note) => (
                            <div key={note.id} className="flex items-center group">
                              <button
                                onClick={() => handleNoteSelect(collection.id, note.id)}
                                className={`flex-1 flex items-center p-2 rounded-md text-left hover:bg-accent ${
                                  workspace.active.collectionId === collection.id && workspace.active.noteId === note.id
                                    ? 'bg-accent'
                                    : ''
                                }`}
                              >
                                <FileText className="mr-2 h-4 w-4 text-muted-foreground" />
                                <div className="flex-1 min-w-0">
                                  <p className="text-sm truncate">{note.title}</p>
                                  <p className="text-xs text-muted-foreground">
                                    {new Date(note.updatedAt).toLocaleDateString()}
                                  </p>
                                </div>
                              </button>
                              
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button 
                                    variant="ghost" 
                                    size="sm" 
                                    className="opacity-0 group-hover:opacity-100 h-6 w-6 p-0"
                                  >
                                    <MoreHorizontal className="h-3 w-3" />
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end">
                                  <DropdownMenuItem onClick={() => handleRenameNote(collection.id, note.id, note.title)}>
                                    <Edit className="mr-2 h-4 w-4" />
                                    Rename
                                  </DropdownMenuItem>
                                  <DropdownMenuItem onClick={() => duplicateNote(collection.id, note.id)}>
                                    <Copy className="mr-2 h-4 w-4" />
                                    Duplicate
                                  </DropdownMenuItem>
                                  <DropdownMenuItem 
                                    onClick={() => handleDeleteNote(collection.id, note.id, note.title)}
                                    className="text-destructive"
                                  >
                                    <Trash2 className="mr-2 h-4 w-4" />
                                    Delete
                                  </DropdownMenuItem>
                                </DropdownMenuContent>
                              </DropdownMenu>
                            </div>
                          ))}
                        </div>
                      </CollapsibleContent>
                    </Collapsible>
                  );
                })}
              </div>
            )}
          </div>

          {/* Recent Notes */}
          {filteredCollections.length > 0 && (
            <div>
              <h3 className="text-sm font-medium text-muted-foreground mb-2">Recent Notes</h3>
              <div className="space-y-1">
                {filteredCollections
                  .flatMap(col => Object.values(col.notes).map(note => ({ ...note, collectionId: col.id })))
                  .sort((a, b) => b.updatedAt - a.updatedAt)
                  .slice(0, 5)
                  .map((note) => (
                    <button
                      key={note.id}
                      onClick={() => handleNoteSelect(note.collectionId, note.id)}
                      className={`w-full flex items-center p-2 rounded-md text-left hover:bg-accent ${
                        workspace.active.collectionId === note.collectionId && workspace.active.noteId === note.id
                          ? 'bg-accent'
                          : ''
                      }`}
                    >
                      <FileText className="mr-3 h-4 w-4 text-muted-foreground" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm truncate">{note.title}</p>
                        <p className="text-xs text-muted-foreground">
                          {new Date(note.updatedAt).toLocaleDateString()}
                        </p>
                      </div>
                    </button>
                  ))}
              </div>
            </div>
          )}

          {searchQuery && filteredCollections.length === 0 && (
            <div className="text-center py-8">
              <p className="text-muted-foreground">No notes found matching "{searchQuery}"</p>
            </div>
          )}
        </div>
      </div>

      {/* Footer */}
      <div className="p-3 border-t border-border">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs text-muted-foreground">
            Storage: {Math.round(JSON.stringify(workspace).length / 1024)}KB
          </span>
        </div>
        <div className="flex gap-1">
          <Button 
            variant="outline" 
            size="sm" 
            onClick={handleExport}
            className="flex-1 h-7 text-xs"
          >
            <Download className="h-3 w-3 mr-1" />
            Export
          </Button>
          <Button 
            variant="outline" 
            size="sm" 
            onClick={handleImport}
            className="flex-1 h-7 text-xs"
          >
            <Upload className="h-3 w-3 mr-1" />
            Import
          </Button>
        </div>
      </div>

      {/* Resize Handle */}
      <div 
        className="absolute top-0 right-0 w-1 h-full cursor-col-resize bg-transparent hover:bg-border transition-colors"
        onMouseDown={(e) => {
          const startX = e.clientX;
          const startWidth = width;
          
          const handleMouseMove = (e: MouseEvent) => {
            const newWidth = startWidth + (e.clientX - startX);
            onResize(newWidth);
          };
          
          const handleMouseUp = () => {
            document.removeEventListener('mousemove', handleMouseMove);
            document.removeEventListener('mouseup', handleMouseUp);
          };
          
          document.addEventListener('mousemove', handleMouseMove);
          document.addEventListener('mouseup', handleMouseUp);
        }}
      />
    </div>
  );
};