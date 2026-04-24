import { useMemo, useState } from "react";
import {
  Tab,
  ObjectType,
  tableFieldHeight,
  tableHeaderHeight,
  tableColorStripHeight,
} from "../../data/constants";
import {
  IconEdit,
  IconMore,
  IconMinus,
  IconDeleteStroked,
  IconKeyStroked,
  IconLock,
  IconUnlock,
} from "@douyinfe/semi-icons";
import { Popover, Tag, Button, SideSheet } from "@douyinfe/semi-ui";
import { useLayout, useSettings, useDiagram, useSelect } from "../../hooks";
import TableInfo from "../EditorSidePanel/TablesTab/TableInfo";
import { useTranslation } from "react-i18next";
import { resolveType } from "../../utils/customTypes";
import { isRtl } from "../../i18n/utils/rtl";
import i18n from "../../i18n/i18n";
import { getCommentHeight, getTableHeight } from "../../utils/utils";

const SAMPLE_CELL_WIDTH = 80;
const SAMPLE_CELL_HEIGHT = 30;
const SAMPLE_HEADER_HEIGHT = 32;
const SAMPLE_ACTION_COL_WIDTH = 32;

export default function Table({
  tableData,
  onPointerDown,
  setHoveredTable,
  handleGripField,
  setLinkingLine,
  isExpanded = false,
  onToggleExpand = () => {},
}) {
  const [hoveredField, setHoveredField] = useState(null);
  const { database } = useDiagram();
  const { layout } = useLayout();
  const { deleteTable, deleteField, updateTable } = useDiagram();
  const { settings } = useSettings();
  const { t } = useTranslation();
  const sampleRows = tableData.sampleRows ?? [];
  const sampleColumnWidths = tableData.sampleColumnWidths ?? {};
  const getColumnWidth = (fieldName) =>
    sampleColumnWidths[fieldName] ?? SAMPLE_CELL_WIDTH;
  const totalColumnsWidth = tableData.fields.reduce(
    (sum, f) => sum + getColumnWidth(f.name),
    0,
  );
  const sampleExpandedWidth = Math.max(
    settings.tableWidth,
    totalColumnsWidth + SAMPLE_ACTION_COL_WIDTH + 16,
  );
  const sampleExpandedHeight =
    tableHeaderHeight +
    tableColorStripHeight +
    SAMPLE_HEADER_HEIGHT +
    (sampleRows.length + 1) * SAMPLE_CELL_HEIGHT +
    16;

  const updateSampleRows = (rows) =>
    updateTable(tableData.id, { sampleRows: rows });
  const updateCell = (rowIdx, fieldName, value) => {
    const next = sampleRows.map((r, i) =>
      i === rowIdx ? { ...r, [fieldName]: value } : r,
    );
    updateSampleRows(next);
  };
  const addSampleRow = () => updateSampleRows([...sampleRows, {}]);
  const removeSampleRow = (rowIdx) =>
    updateSampleRows(sampleRows.filter((_, i) => i !== rowIdx));

  const startColumnResize = (e, fieldName) => {
    e.stopPropagation();
    e.preventDefault();
    const startX = e.clientX;
    const startW = getColumnWidth(fieldName);
    const onMove = (ev) => {
      const dx = ev.clientX - startX;
      const newW = Math.max(40, Math.round(startW + dx));
      updateTable(tableData.id, {
        sampleColumnWidths: {
          ...(tableData.sampleColumnWidths ?? {}),
          [fieldName]: newW,
        },
      });
    };
    const onUp = () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  };
  const {
    selectedElement,
    setSelectedElement,
    bulkSelectedElements,
    setBulkSelectedElements,
  } = useSelect();

  const borderColor = useMemo(
    () => (settings.mode === "light" ? "border-zinc-300" : "border-zinc-600"),
    [settings.mode],
  );

  const height = getTableHeight(
    tableData,
    settings.tableWidth,
    settings.showComments,
  );

  const isSelected = useMemo(() => {
    return (
      (selectedElement.id == tableData.id &&
        selectedElement.element === ObjectType.TABLE) ||
      bulkSelectedElements.some(
        (e) => e.type === ObjectType.TABLE && e.id === tableData.id,
      )
    );
  }, [selectedElement, tableData, bulkSelectedElements]);

  const lockUnlockTable = (e) => {
    const locking = !tableData.locked;
    updateTable(tableData.id, { locked: locking });

    const lockTable = () => {
      setSelectedElement({
        ...selectedElement,
        element: ObjectType.NONE,
        id: -1,
        open: false,
      });
      setBulkSelectedElements((prev) =>
        prev.filter(
          (el) => el.id !== tableData.id || el.type !== ObjectType.TABLE,
        ),
      );
    };

    const unlockTable = () => {
      const elementInBulk = {
        id: tableData.id,
        type: ObjectType.TABLE,
        initialCoords: { x: tableData.x, y: tableData.y },
        currentCoords: { x: tableData.x, y: tableData.y },
      };
      if (e.ctrlKey || e.metaKey) {
        setBulkSelectedElements((prev) => [...prev, elementInBulk]);
      } else {
        setBulkSelectedElements([elementInBulk]);
      }
      setSelectedElement((prev) => ({
        ...prev,
        element: ObjectType.TABLE,
        id: tableData.id,
        open: false,
      }));
    };

    if (locking) {
      lockTable();
    } else {
      unlockTable();
    }
  };

  const handleDoubleClick = () => {
    if (settings.sampleDataMode) {
      onToggleExpand();
      return;
    }
    openEditor();
  };

  const openEditor = () => {
    if (!layout.sidebar) {
      setSelectedElement((prev) => ({
        ...prev,
        element: ObjectType.TABLE,
        id: tableData.id,
        open: true,
      }));
    } else {
      setSelectedElement((prev) => ({
        ...prev,
        currentTab: Tab.TABLES,
        element: ObjectType.TABLE,
        id: tableData.id,
        open: true,
      }));
      if (selectedElement.currentTab !== Tab.TABLES) return;
      document
        .getElementById(`scroll_table_${tableData.id}`)
        .scrollIntoView({ behavior: "smooth" });
    }
  };

  if (tableData.hidden) return null;

  return (
    <>
      <foreignObject
        key={tableData.id}
        x={tableData.x}
        y={tableData.y}
        width={
          settings.sampleDataMode && isExpanded
            ? sampleExpandedWidth
            : settings.tableWidth
        }
        height={
          settings.sampleDataMode && isExpanded ? sampleExpandedHeight : height
        }
        className="group drop-shadow-lg rounded-md cursor-move"
        onPointerDown={onPointerDown}
      >
        <div
          onDoubleClick={handleDoubleClick}
          className={`border-2 hover:border-dashed hover:border-blue-500
               select-none rounded-lg w-full ${
                 settings.mode === "light"
                   ? "bg-zinc-100 text-zinc-800"
                   : "bg-zinc-800 text-zinc-200"
               } ${isSelected ? "border-solid border-blue-500" : borderColor}`}
          style={{ direction: "ltr" }}
        >
          <div
            className="h-[10px] w-full rounded-t-md"
            style={{ backgroundColor: tableData.color }}
          />
          <div
            className={`border-b border-gray-400 ${
              settings.mode === "light" ? "bg-zinc-200" : "bg-zinc-900"
            } ${tableData.comment && settings.showComments ? "pb-3" : ""}`}
          >
            <div
              className={`overflow-hidden font-bold h-[40px] flex justify-between items-center`}
            >
              <div className="px-3 overflow-hidden text-ellipsis whitespace-nowrap">
                {tableData.name}
              </div>
              {!layout.readOnly && (
              <div className="hidden group-hover:block">
                <div className="flex justify-end items-center mx-2 space-x-1.5">
                  <Button
                    icon={tableData.locked ? <IconLock /> : <IconUnlock />}
                    size="small"
                    theme="solid"
                    style={{
                      backgroundColor: "#2f68adb3",
                    }}
                    disabled={layout.readOnly}
                    onClick={lockUnlockTable}
                  />
                  <Button
                    icon={<IconEdit />}
                    size="small"
                    theme="solid"
                    style={{
                      backgroundColor: "#2f68adb3",
                    }}
                    onClick={openEditor}
                  />
                  <Popover
                    key={tableData.id}
                    content={
                      <div className="popover-theme">
                        <div className="mb-2">
                          <strong>{t("comment")}:</strong>{" "}
                          {tableData.comment === "" ? (
                            t("not_set")
                          ) : (
                            <div>{tableData.comment}</div>
                          )}
                        </div>
                        <div>
                          <strong
                            className={`${
                              tableData.indices.length === 0 ? "" : "block"
                            }`}
                          >
                            {t("indices")}:
                          </strong>{" "}
                          {tableData.indices.length === 0 ? (
                            t("not_set")
                          ) : (
                            <div>
                              {tableData.indices.map((index, k) => (
                                <div
                                  key={k}
                                  className={`flex items-center my-1 px-2 py-1 rounded ${
                                    settings.mode === "light"
                                      ? "bg-gray-100"
                                      : "bg-zinc-800"
                                  }`}
                                >
                                  <i className="fa-solid fa-thumbtack me-2 mt-1 text-slate-500"></i>
                                  <div>
                                    {index.fields.map((f) => (
                                      <Tag
                                        color="blue"
                                        key={f}
                                        className="me-1"
                                      >
                                        {f}
                                      </Tag>
                                    ))}
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                        <Button
                          icon={<IconDeleteStroked />}
                          type="danger"
                          block
                          style={{ marginTop: "8px" }}
                          onClick={() => deleteTable(tableData.id)}
                          disabled={layout.readOnly}
                        >
                          {t("delete")}
                        </Button>
                      </div>
                    }
                    position="rightTop"
                    showArrow
                    trigger="click"
                    style={{ width: "200px", wordBreak: "break-word" }}
                  >
                    <Button
                      icon={<IconMore />}
                      type="tertiary"
                      size="small"
                      style={{
                        backgroundColor: "#808080b3",
                        color: "white",
                      }}
                    />
                  </Popover>
                </div>
              </div>
              )}
            </div>
            {tableData.comment && settings.showComments && (
              <div className="text-xs px-3 line-clamp-5">
                {tableData.comment}
              </div>
            )}
          </div>

          {settings.sampleDataMode && renderMiniTable()}
          {!settings.sampleDataMode &&
            tableData.fields.map((e, i) => {
            const resolved = resolveType(database, e.type);
            return settings.showFieldSummary && !layout.readOnly ? (
              <Popover
                key={i}
                content={
                  <div className="popover-theme">
                    <div
                      className="flex justify-between items-center pb-2"
                      style={{ direction: "ltr" }}
                    >
                      <p className="me-4 font-bold">{e.name}</p>
                      <p
                        className={
                          "ms-4 font-mono " +
                          (resolved.isCustom ? "" : resolved.color)
                        }
                        style={
                          resolved.isCustom ? { color: resolved.color } : {}
                        }
                      >
                        {e.type +
                          ((resolved.isSized || resolved.hasPrecision) &&
                          e.size &&
                          e.size !== ""
                            ? "(" + e.size + ")"
                            : "")}
                      </p>
                    </div>
                    <hr />
                    {e.primary && (
                      <Tag color="blue" className="me-2 my-2">
                        {t("primary")}
                      </Tag>
                    )}
                    {e.unique && (
                      <Tag color="amber" className="me-2 my-2">
                        {t("unique")}
                      </Tag>
                    )}
                    {e.notNull && (
                      <Tag color="purple" className="me-2 my-2">
                        {t("not_null")}
                      </Tag>
                    )}
                    {e.increment && (
                      <Tag color="green" className="me-2 my-2">
                        {t("autoincrement")}
                      </Tag>
                    )}
                    <p>
                      <strong>{t("default_value")}: </strong>
                      {e.default === "" ? t("not_set") : e.default}
                    </p>
                    <p>
                      <strong>{t("comment")}: </strong>
                      {e.comment === "" ? t("not_set") : e.comment}
                    </p>
                  </div>
                }
                position="right"
                showArrow
                style={
                  isRtl(i18n.language)
                    ? { direction: "rtl" }
                    : { direction: "ltr" }
                }
              >
                {field(e, i)}
              </Popover>
            ) : (
              field(e, i)
            );
          })}
        </div>
      </foreignObject>
      <SideSheet
        title={t("edit")}
        size="small"
        visible={
          selectedElement.element === ObjectType.TABLE &&
          selectedElement.id === tableData.id &&
          selectedElement.open &&
          !layout.sidebar
        }
        onCancel={() =>
          setSelectedElement((prev) => ({
            ...prev,
            open: !prev.open,
          }))
        }
        style={{ paddingBottom: "16px" }}
      >
        <div className="sidesheet-theme">
          <TableInfo data={tableData} />
        </div>
      </SideSheet>
    </>
  );

  function renderMiniTable() {
    const cellBorder =
      settings.mode === "light" ? "border-zinc-300" : "border-zinc-600";
    const editable = isExpanded && !layout.readOnly;
    return (
      <div
        className={isExpanded ? "overflow-visible" : "overflow-hidden"}
        style={{
          height: isExpanded ? "auto" : height - tableHeaderHeight - tableColorStripHeight,
        }}
      >
        <table
          className="text-xs border-collapse select-none"
          style={{ tableLayout: "fixed" }}
        >
          <thead>
            <tr>
              {tableData.fields.map((f) => (
                <th
                  key={f.id}
                  className={`relative px-2 py-1 border ${cellBorder} text-left font-semibold overflow-hidden`}
                  style={{
                    minWidth: getColumnWidth(f.name),
                    width: getColumnWidth(f.name),
                    maxWidth: getColumnWidth(f.name),
                    height: SAMPLE_HEADER_HEIGHT,
                  }}
                >
                  <span className="block truncate">{f.name}</span>
                  <div
                    onPointerDown={(e) => startColumnResize(e, f.name)}
                    className="absolute top-0 right-0 h-full w-1.5 cursor-col-resize hover:bg-sky-400/50"
                    style={{ touchAction: "none" }}
                  />
                </th>
              ))}
              {editable && (
                <th
                  className={`border ${cellBorder}`}
                  style={{ width: SAMPLE_ACTION_COL_WIDTH }}
                />
              )}
            </tr>
          </thead>
          <tbody>
            {sampleRows.map((row, rowIdx) => (
              <tr key={rowIdx}>
                {tableData.fields.map((f) => (
                  <td
                    key={f.id}
                    className={`px-2 border ${cellBorder} overflow-hidden`}
                    style={{
                      minWidth: getColumnWidth(f.name),
                      width: getColumnWidth(f.name),
                      maxWidth: getColumnWidth(f.name),
                      height: SAMPLE_CELL_HEIGHT,
                    }}
                  >
                    {editable ? (
                      <input
                        className="w-full bg-transparent outline-none"
                        value={row[f.name] ?? ""}
                        onChange={(e) =>
                          updateCell(rowIdx, f.name, e.target.value)
                        }
                        onPointerDown={(e) => e.stopPropagation()}
                        onDoubleClick={(e) => e.stopPropagation()}
                      />
                    ) : (
                      <span className="block truncate">
                        {row[f.name] ?? ""}
                      </span>
                    )}
                  </td>
                ))}
                {editable && (
                  <td
                    className={`border ${cellBorder} text-center`}
                    style={{
                      width: SAMPLE_ACTION_COL_WIDTH,
                      height: SAMPLE_CELL_HEIGHT,
                    }}
                  >
                    <button
                      onClick={() => removeSampleRow(rowIdx)}
                      onPointerDown={(e) => e.stopPropagation()}
                      className="text-red-600 text-lg leading-none font-bold"
                    >
                      ×
                    </button>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
        {editable && (
          <div
            className="mt-1 px-2"
            onPointerDown={(e) => e.stopPropagation()}
            onDoubleClick={(e) => e.stopPropagation()}
          >
            <Button onClick={addSampleRow} size="small" type="tertiary">
              + {t("add_row")}
            </Button>
          </div>
        )}
      </div>
    );
  }

  function field(fieldData, index) {
    const fieldResolved = resolveType(database, fieldData.type);
    return (
      <div
        className={`${
          index === tableData.fields.length - 1
            ? ""
            : "border-b border-gray-400"
        } group h-[36px] px-2 py-1 flex justify-between items-center gap-1 w-full overflow-hidden`}
        onPointerEnter={(e) => {
          if (!e.isPrimary) return;

          setHoveredField(index);
          setHoveredTable({
            tableId: tableData.id,
            fieldId: fieldData.id,
          });
        }}
        onPointerLeave={(e) => {
          if (!e.isPrimary) return;

          setHoveredField(null);
          setHoveredTable({
            tableId: null,
            fieldId: null,
          });
        }}
        onPointerDown={(e) => {
          // Required for onPointerLeave to trigger when a touch pointer leaves
          // https://stackoverflow.com/a/70976017/1137077
          e.target.releasePointerCapture(e.pointerId);
        }}
      >
        <div
          className={`${
            hoveredField === index ? "text-zinc-400" : ""
          } flex items-center gap-2 overflow-hidden`}
        >
          <button
            className="shrink-0 w-[10px] h-[10px] bg-[#2f68adcc] rounded-full"
            onPointerDown={(e) => {
              if (!e.isPrimary) return;

              handleGripField();
              setLinkingLine((prev) => ({
                ...prev,
                startFieldId: fieldData.id,
                startTableId: tableData.id,
                startX: tableData.x + 15,
                startY:
                  tableData.y +
                  index * tableFieldHeight +
                  tableHeaderHeight +
                  tableColorStripHeight +
                  getCommentHeight(
                    tableData.comment,
                    settings.tableWidth,
                    settings.showComments,
                  ) +
                  14,
                endX: tableData.x + 15,
                endY:
                  tableData.y +
                  index * tableFieldHeight +
                  tableHeaderHeight +
                  tableColorStripHeight +
                  getCommentHeight(
                    tableData.comment,
                    settings.tableWidth,
                    settings.showComments,
                  ) +
                  14,
              }));
            }}
          />
          <span className="overflow-hidden text-ellipsis whitespace-nowrap">
            {fieldData.name}
          </span>
        </div>
        <div className="text-zinc-400">
          {hoveredField === index && !layout.readOnly ? (
            <Button
              theme="solid"
              size="small"
              style={{
                backgroundColor: "#d42020b3",
              }}
              icon={<IconMinus />}
              disabled={layout.readOnly}
              onClick={() => {
                if (layout.readOnly) return;
                deleteField(fieldData, tableData.id);
              }}
            />
          ) : (
            <div className="flex gap-1 items-center">
              {fieldData.primary && <IconKeyStroked />}
              {settings.showDataTypes && (
                <>
                  {!fieldData.notNull && (
                    <span className="font-mono">?</span>
                  )}
                  <span
                    className={
                      "font-mono " +
                      (fieldResolved.isCustom ? "" : fieldResolved.color)
                    }
                    style={
                      fieldResolved.isCustom
                        ? { color: fieldResolved.color }
                        : {}
                    }
                  >
                    {fieldData.type +
                      ((fieldResolved.isSized || fieldResolved.hasPrecision) &&
                      fieldData.size &&
                      fieldData.size !== ""
                        ? `(${fieldData.size})`
                        : "")}
                  </span>
                </>
              )}
            </div>
          )}
        </div>
      </div>
    );
  }
}
