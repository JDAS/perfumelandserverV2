import { useObjectMetadata } from "../../../context/ObjectMetadataContext";
import { BadgeChip } from "./WorkspaceChrome";
import { RecordDetailPanel } from "./RecordDetailPanel";

export function RecordWorkspace({
  objectDef,
  tab,
  onActivateSubtab,
  onCloseSubtab,
  onOpenChild,
  onOpenLookupRecord,
  onRecordSaved,
  onRefreshRecord,
  onStartEdit,
  onCancelEdit,
}) {
  const { getObjectByApiNameFromCache } = useObjectMetadata();
  const activeSubtab =
    tab.subtabs.find((subtab) => subtab.id === tab.activeSubtabId) || tab.subtabs[0];
  const isEditingMainRecord = activeSubtab.id === "edit";

  const childObjectDef =
    activeSubtab.type === "record"
      ? getObjectByApiNameFromCache(activeSubtab.objectApi) || objectDef
      : objectDef;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        {tab.subtabs.filter((subtab) => subtab.id !== "edit").map((subtab) => (
          <BadgeChip
            key={subtab.id}
            active={subtab.id === activeSubtab.id}
            label={subtab.label}
            onClick={() => onActivateSubtab(subtab.id)}
            onClose={() => onCloseSubtab(subtab.id)}
            closable={!subtab.pinned}
          />
        ))}
      </div>

      {activeSubtab.type === "detail" || isEditingMainRecord ? (
        <RecordDetailPanel
          objectDef={objectDef}
          recordId={tab.recordId}
          refreshKey={tab.refreshKey}
          allowChildren
          onOpenChild={onOpenChild}
          onOpenLookupRecord={onOpenLookupRecord}
          onParentRefresh={() => onRefreshRecord(tab.id)}
          mode={isEditingMainRecord ? "edit" : "view"}
          onStartEdit={() => onStartEdit(tab.id)}
          onCancelEdit={() => onCancelEdit(tab.id)}
          onSaved={(updatedRecord) => onRecordSaved(tab.id, objectDef, updatedRecord)}
        />
      ) : (
        <RecordDetailPanel
          objectDef={childObjectDef}
          recordId={activeSubtab.recordId}
          refreshKey={tab.refreshKey}
          allowChildren
          onOpenChild={onOpenChild}
          onOpenLookupRecord={onOpenLookupRecord}
          onParentRefresh={() => onRefreshRecord(tab.id)}
          mode={tab.activeSubtabId === "edit" ? "edit" : "view"}
          onStartEdit={() => onStartEdit(tab.id)}
          onCancelEdit={() => onCancelEdit(tab.id)}
          onSaved={(updatedRecord) => onRecordSaved(tab.id, childObjectDef, updatedRecord)}
        />
      )}
    </div>
  );
}
