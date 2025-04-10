"use client";

import qs from "qs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { DndContext, DragEndEvent, closestCenter } from "@dnd-kit/core";
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
  arrayMove,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { ChevronUp, ChevronDown, X } from "lucide-react";
import React from "react";

export interface SortToken {
  field: string;
  direction: "asc" | "desc";
}

function SortableSortItem({
  token,
  onRemove,
  onToggleDirection,
}: {
  token: SortToken;
  onRemove: () => void;
  onToggleDirection: () => void;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: token.field });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      className="flex items-center justify-between rounded border border-gray-300 bg-white px-3 py-2 shadow-sm"
    >
      <div {...listeners} className="mr-2 cursor-grab text-gray-500">
        ☰
      </div>
      <div
        className="flex-1 cursor-pointer select-none"
        onClick={onToggleDirection}
      >
        {token.field}{" "}
        {token.direction === "asc" ? (
          <ChevronUp className="inline h-4 w-4" />
        ) : (
          <ChevronDown className="inline h-4 w-4" />
        )}
      </div>
      <Button variant="ghost" size="icon" onClick={onRemove}>
        <X className="h-4 w-4 text-gray-500 hover:text-red-600" />
      </Button>
    </div>
  );
}

interface GuidedSortBarProps {
  queryString: string;
  onSortTokensChange: (newTokens: SortToken[]) => void;
  sortableFields: string[];
}

export default function GuidedSortBar({
  queryString,
  onSortTokensChange,
  sortableFields,
}: GuidedSortBarProps) {
  const [selectedField, setSelectedField] = React.useState("");
  const [selectedDirection, setSelectedDirection] = React.useState<
    "asc" | "desc"
  >("asc");

  const sortTokens = React.useMemo(() => {
    const query = qs.parse(queryString, { ignoreQueryPrefix: true });
    if (typeof query.sort === "string") {
      return query.sort.split(",").map((s) => {
        const [field, dir] = s.split(":");
        return { field, direction: (dir as "asc" | "desc") || "asc" };
      });
    }
    return [];
  }, [queryString]);

  const availableFields = React.useMemo(() => {
    const used = new Set(sortTokens.map((t) => t.field));
    return sortableFields.filter((f) => !used.has(f));
  }, [sortableFields, sortTokens]);

  const addSort = () => {
    if (!selectedField) return;
    if (!sortTokens.some((token) => token.field === selectedField)) {
      onSortTokensChange([
        ...sortTokens,
        { field: selectedField, direction: selectedDirection },
      ]);
    }
    setSelectedField("");
    setSelectedDirection("asc");
  };

  const removeSort = (field: string) => {
    const updated = sortTokens.filter((t) => t.field !== field);
    onSortTokensChange(updated);
  };

  const toggleDirection = (field: string) => {
    const updated = sortTokens.map((token) =>
      token.field === field
        ? {
            ...token,
            direction: (token.direction === "asc" ? "desc" : "asc") as
              | "asc"
              | "desc",
          }
        : token,
    );
    onSortTokensChange(updated);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = sortTokens.findIndex((t) => t.field === active.id);
    const newIndex = sortTokens.findIndex((t) => t.field === over.id);
    const reordered = arrayMove(sortTokens, oldIndex, newIndex);
    onSortTokensChange(reordered);
  };

  const clearAllSorts = () => {
    onSortTokensChange([]);
  };

  return (
    <div className="w-full space-y-4 rounded-md border bg-white p-4 shadow-sm">
      <h2 className="text-lg font-semibold">Sort Order</h2>

      <div className="flex flex-wrap items-center gap-4">
        <Select value={selectedField} onValueChange={setSelectedField}>
          <SelectTrigger className="w-48">
            <SelectValue placeholder="Select field..." />
          </SelectTrigger>
          <SelectContent>
            {availableFields.map((field) => (
              <SelectItem key={field} value={field}>
                {field}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {selectedField && (
          <Select
            value={selectedDirection}
            onValueChange={(v) => setSelectedDirection(v as "asc" | "desc")}
          >
            <SelectTrigger className="w-24">
              <SelectValue placeholder="asc/desc" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="asc">asc</SelectItem>
              <SelectItem value="desc">desc</SelectItem>
            </SelectContent>
          </Select>
        )}

        {selectedField && selectedDirection && (
          <Button onClick={addSort}>Add Sort</Button>
        )}
      </div>

      {sortTokens.length > 0 && (
        <>
          <DndContext
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
          >
            <SortableContext
              items={sortTokens.map((t) => t.field)}
              strategy={verticalListSortingStrategy}
            >
              <div className="space-y-2">
                {sortTokens.map((token) => (
                  <SortableSortItem
                    key={token.field}
                    token={token}
                    onRemove={() => removeSort(token.field)}
                    onToggleDirection={() => toggleDirection(token.field)}
                  />
                ))}
              </div>
            </SortableContext>
          </DndContext>

          <Button
            variant="link"
            onClick={clearAllSorts}
            className="text-sm text-blue-600"
          >
            Clear All Sorts
          </Button>
        </>
      )}
    </div>
  );
}
