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
      className="flex flex-col h-full bg-card border-r border-border"
      style={{ width }}
    >
      {/* Header */}
      <div className="flex items-center justify-between p-3 border-b border-border">
        <h2 className="font-semibold text-sm">Whiteboard Notes</h2>
        <div className="flex items-center gap-1">
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={handleCreateCollection}
            className="h-7 w-7 p-0"
            title="New Collection"
          >
            <FolderPlus className="h-4 w-4" />
          </Button>
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={toggleLeftSidebar}
            className="h-7 w-7 p-0"
            title="Close Sidebar"
          >
            <PanelLeftClose className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Search */}
      <div className="p-3 border-b border-border">
        <div className="relative">
          <Search className="absolute left-2 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search notes..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-8 h-8"
          />
        </div>
      </div>

      {/* Collections & Notes */}
      <div className="flex-1 overflow-auto p-2">
        {filteredCollections.length === 0 ? (
          <div className="text-center text-muted-foreground text-sm py-8">
            {searchQuery ? 'No matching notes found' : 'No collections yet'}
          </div>
        ) : (
          <div className="space-y-1">
            {filteredCollections.map(collection => (
              <Collapsible
                key={collection.id}
                open={expandedCollections.has(collection.id)}
                onOpenChange={() => toggleCollection(collection.id)}
              >
                <div className="flex items-center group">
                  <CollapsibleTrigger asChild>
                    <Button variant="ghost" size="sm" className="flex-1 justify-start h-8 px-2">
                      {expandedCollections.has(collection.id) ? 
                        <ChevronDown className="h-4 w-4 mr-1" /> : 
                        <ChevronRight className="h-4 w-4 mr-1" />
                      }
                      <span className="truncate">{collection.title}</span>
                    </Button>
                  </CollapsibleTrigger>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button 
                        variant="ghost" 
                        size="sm" 
                        className="h-6 w-6 p-0 opacity-0 group-hover:opacity-100"
                      >
                        <MoreHorizontal className="h-3 w-3" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => handleCreateNote(collection.id)}>
                        <Plus className="h-4 w-4 mr-2" />
                        New Note
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => handleRenameCollection(collection.id, collection.title)}>
                        <Edit className="h-4 w-4 mr-2" />
                        Rename
                      </DropdownMenuItem>
                      <DropdownMenuItem 
                        onClick={() => handleDeleteCollection(collection.id, collection.title)}
                        className="text-destructive"
                      >
                        <Trash2 className="h-4 w-4 mr-2" />
                        Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>

                <CollapsibleContent>
                  <div className="ml-6 space-y-1">
                    {collection.noteOrder.map(noteId => {
                      const note = collection.notes[noteId];
                      if (!note) return null;
                      
                      const isActive = workspace.active.noteId === noteId;
                      const matchesSearch = !searchQuery || 
                        note.title.toLowerCase().includes(searchQuery.toLowerCase());
                      
                      if (!matchesSearch) return null;
                      
                      return (
                        <div key={noteId} className="flex items-center group">
                          <Button
                            variant={isActive ? "secondary" : "ghost"}
                            size="sm"
                            className="flex-1 justify-start h-7 px-2 text-xs"
                            onClick={() => handleNoteSelect(collection.id, noteId)}
                          >
                            <FileText className="h-3 w-3 mr-2" />
                            <span className="truncate">{note.title}</span>
                          </Button>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button 
                                variant="ghost" 
                                size="sm" 
                                className="h-6 w-6 p-0 opacity-0 group-hover:opacity-100"
                              >
                                <MoreHorizontal className="h-3 w-3" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={() => handleRenameNote(collection.id, noteId, note.title)}>
                                <Edit className="h-4 w-4 mr-2" />
                                Rename
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => duplicateNote(collection.id, noteId)}>
                                <Copy className="h-4 w-4 mr-2" />
                                Duplicate
                              </DropdownMenuItem>
                              <DropdownMenuItem 
                                onClick={() => handleDeleteNote(collection.id, noteId, note.title)}
                                className="text-destructive"
                              >
                                <Trash2 className="h-4 w-4 mr-2" />
                                Delete
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      );
                    })}
                  </div>
                </CollapsibleContent>
              </Collapsible>
            ))}
          </div>
        )}
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