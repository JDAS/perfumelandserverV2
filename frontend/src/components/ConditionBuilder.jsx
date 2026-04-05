import React from "react";

const CONDITION_OPERATORS = [
  "eq",
  "ne",
  "gt",
  "gte",
  "lt",
  "lte",
  "contains",
  "changed",
  "isEmpty",
  "isNotEmpty",
];

function isGroup(node) {
  return node && typeof node === "object" && Array.isArray(node.conditions);
}

function createEmptyCondition() {
  return {
    field: "",
    operator: "eq",
    value: "",
  };
}

function createEmptyGroup() {
  return {
    operator: "AND",
    conditions: [createEmptyCondition()],
  };
}

function updateNodeAtPath(tree, path, updater) {
  if (path.length === 0) {
    return updater(tree);
  }

  const [head, ...rest] = path;

  return {
    ...tree,
    conditions: tree.conditions.map((child, index) => {
      if (index !== head) return child;

      if (rest.length === 0) {
        return updater(child);
      }

      if (!isGroup(child)) return child;
      return updateNodeAtPath(child, rest, updater);
    }),
  };
}

function removeNodeAtPath(tree, path) {
  if (path.length === 1) {
    const indexToRemove = path[0];
    return {
      ...tree,
      conditions: tree.conditions.filter((_, index) => index !== indexToRemove),
    };
  }

  const [head, ...rest] = path;

  return {
    ...tree,
    conditions: tree.conditions.map((child, index) => {
      if (index !== head) return child;
      if (!isGroup(child)) return child;
      return removeNodeAtPath(child, rest);
    }),
  };
}

function ConditionRow({ node, path, fields, onChange, onRemove }) {
  const hideValue =
    node.operator === "changed" ||
    node.operator === "isEmpty" ||
    node.operator === "isNotEmpty";

  return (
    <div className="grid grid-cols-1 gap-3 rounded border p-3 md:grid-cols-4">
      <div>
        <label className="mb-1 block text-xs font-medium">Campo</label>
        <select
          className="w-full rounded border p-2"
          value={node.field || ""}
          onChange={(e) =>
            onChange(path, {
              ...node,
              field: e.target.value,
            })
          }
        >
          <option value="">Seleccione...</option>
          {fields.map((field) => (
            <option key={field.apiName} value={field.apiName}>
              {field.label} ({field.apiName})
            </option>
          ))}
        </select>
      </div>

      <div>
        <label className="mb-1 block text-xs font-medium">Operador</label>
        <select
          className="w-full rounded border p-2"
          value={node.operator || "eq"}
          onChange={(e) =>
            onChange(path, {
              ...node,
              operator: e.target.value,
            })
          }
        >
          {CONDITION_OPERATORS.map((operator) => (
            <option key={operator} value={operator}>
              {operator}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label className="mb-1 block text-xs font-medium">Valor</label>
        <input
          className="w-full rounded border p-2"
          value={node.value ?? ""}
          disabled={hideValue}
          onChange={(e) =>
            onChange(path, {
              ...node,
              value: e.target.value,
            })
          }
        />
      </div>

      <div className="flex items-end">
        <button
          type="button"
          onClick={() => onRemove(path)}
          className="rounded border px-3 py-2 text-red-600"
        >
          Eliminar
        </button>
      </div>
    </div>
  );
}

function ConditionGroup({
  group,
  path,
  fields,
  onChange,
  onAddCondition,
  onAddGroup,
  onRemove,
}) {
  return (
    <div className="space-y-3 rounded-xl border bg-gray-50 p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold">Grupo</span>

          <select
            className="rounded border p-2 text-sm"
            value={group.operator || "AND"}
            onChange={(e) =>
              onChange(path, {
                ...group,
                operator: e.target.value,
              })
            }
          >
            <option value="AND">AND</option>
            <option value="OR">OR</option>
          </select>
        </div>

        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => onAddCondition(path)}
            className="rounded border px-3 py-2 text-sm"
          >
            + Condición
          </button>

          <button
            type="button"
            onClick={() => onAddGroup(path)}
            className="rounded border px-3 py-2 text-sm"
          >
            + Grupo
          </button>

          {path.length > 0 && (
            <button
              type="button"
              onClick={() => onRemove(path)}
              className="rounded border px-3 py-2 text-sm text-red-600"
            >
              Eliminar grupo
            </button>
          )}
        </div>
      </div>

      <div className="space-y-3">
        {(group.conditions || []).map((child, index) => {
          const childPath = [...path, index];

          if (isGroup(child)) {
            return (
              <ConditionGroup
                key={childPath.join("-")}
                group={child}
                path={childPath}
                fields={fields}
                onChange={onChange}
                onAddCondition={onAddCondition}
                onAddGroup={onAddGroup}
                onRemove={onRemove}
              />
            );
          }

          return (
            <ConditionRow
              key={childPath.join("-")}
              node={child}
              path={childPath}
              fields={fields}
              onChange={onChange}
              onRemove={onRemove}
            />
          );
        })}
      </div>
    </div>
  );
}

function normalizeConditionsTree(value) {
  if (!value) return createEmptyGroup();

  if (Array.isArray(value)) {
    return {
      operator: "AND",
      conditions: value.length ? value : [createEmptyCondition()],
    };
  }

  if (isGroup(value)) {
    return {
      operator: value.operator || "AND",
      conditions:
        value.conditions && value.conditions.length
          ? value.conditions
          : [createEmptyCondition()],
    };
  }

  return createEmptyGroup();
}

function ConditionBuilder({ value, onChange, fields = [] }) {
  const tree = normalizeConditionsTree(value);

  const handleChangeNode = (path, nextNode) => {
    if (path.length === 0) {
      onChange(nextNode);
      return;
    }

    onChange(updateNodeAtPath(tree, path, () => nextNode));
  };

  const handleAddCondition = (path) => {
    const nextTree =
      path.length === 0
        ? {
            ...tree,
            conditions: [...tree.conditions, createEmptyCondition()],
          }
        : updateNodeAtPath(tree, path, (node) => ({
            ...node,
            conditions: [...(node.conditions || []), createEmptyCondition()],
          }));

    onChange(nextTree);
  };

  const handleAddGroup = (path) => {
    const nextTree =
      path.length === 0
        ? {
            ...tree,
            conditions: [...tree.conditions, createEmptyGroup()],
          }
        : updateNodeAtPath(tree, path, (node) => ({
            ...node,
            conditions: [...(node.conditions || []), createEmptyGroup()],
          }));

    onChange(nextTree);
  };

  const handleRemove = (path) => {
    if (path.length === 0) return;

    const nextTree = removeNodeAtPath(tree, path);

    if (!nextTree.conditions.length) {
      onChange(createEmptyGroup());
      return;
    }

    onChange(nextTree);
  };

  return (
    <ConditionGroup
      group={tree}
      path={[]}
      fields={fields}
      onChange={handleChangeNode}
      onAddCondition={handleAddCondition}
      onAddGroup={handleAddGroup}
      onRemove={handleRemove}
    />
  );
}

export default ConditionBuilder;