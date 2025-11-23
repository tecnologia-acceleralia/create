import { useRef, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import CodeMirror from '@uiw/react-codemirror';
import { html } from '@codemirror/lang-html';
import { EditorView } from '@codemirror/view';
import { cn } from '@/utils/cn';
import { AssetMarkerSelector } from './AssetMarkerSelector';

type RichTextEditorProps = {
  id?: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  minHeight?: string;
  eventId?: number;
  onInsertMarker?: (marker: string) => void;
};

export function RichTextEditor({
  id,
  value,
  onChange,
  placeholder,
  className,
  minHeight = '200px',
  eventId,
  onInsertMarker
}: RichTextEditorProps) {
  const { t } = useTranslation();
  const editorViewRef = useRef<EditorView | null>(null);

  // Convertir minHeight de string a número para CodeMirror
  const height = useMemo(() => {
    if (typeof minHeight === 'string') {
      const match = minHeight.match(/(\d+)/);
      return match ? parseInt(match[1], 10) : 200;
    }
    return 200;
  }, [minHeight]);

  const handleInsertMarker = (marker: string) => {
    if (editorViewRef.current) {
      const view = editorViewRef.current;
      const { from, to } = view.state.selection.main;
      const transaction = view.state.update({
        changes: { from, to, insert: marker }
      });
      view.dispatch(transaction);
      view.focus();
    } else {
      // Fallback: añadir al final si no hay referencia al editor
      onChange((value || '') + marker);
    }
  };

  return (
    <div className={cn('flex flex-col border border-input rounded-md bg-background overflow-hidden', className)}>
      {/* Editor Content */}
      <div 
        className="flex-1 overflow-hidden"
        style={{ minHeight }}
      >
        <CodeMirror
          value={value || ''}
          height={`${height}px`}
          extensions={[
            html(),
            EditorView.theme({
              '&': {
                fontSize: '14px',
                fontFamily: 'ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, "Liberation Mono", monospace'
              },
              '.cm-content': {
                padding: '12px',
                minHeight: minHeight
              },
              '.cm-focused': {
                outline: 'none'
              },
              '.cm-editor': {
                backgroundColor: 'hsl(var(--background))',
                color: 'hsl(var(--foreground))'
              },
              '.cm-gutters': {
                backgroundColor: 'hsl(var(--muted))',
                color: 'hsl(var(--muted-foreground))',
                border: 'none'
              },
              '.cm-lineNumbers .cm-lineNumber': {
                color: 'hsl(var(--muted-foreground))'
              },
              '.cm-activeLineGutter': {
                backgroundColor: 'hsl(var(--muted))'
              },
              '.cm-activeLine': {
                backgroundColor: 'hsl(var(--muted) / 0.3)'
              },
              '.cm-selectionBackground': {
                backgroundColor: 'hsl(var(--primary) / 0.2)'
              }
            }),
            EditorView.updateListener.of((update) => {
              if (update.view) {
                editorViewRef.current = update.view;
              }
            })
          ]}
          onChange={(val) => onChange(val)}
          placeholder={placeholder}
          basicSetup={{
            lineNumbers: true,
            foldGutter: true,
            dropCursor: false,
            allowMultipleSelections: false,
            indentOnInput: true,
            bracketMatching: true,
            closeBrackets: true,
            autocompletion: true,
            highlightSelectionMatches: true,
            tabSize: 2
          }}
          id={id}
        />
      </div>

      {/* Asset Marker Selector */}
      {eventId && (
        <div className="border-t border-border p-2 bg-muted/30">
          <AssetMarkerSelector 
            eventId={eventId}
            onMarkerInsert={handleInsertMarker}
          />
        </div>
      )}
    </div>
  );
}
