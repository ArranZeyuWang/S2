import { IGroup } from '@antv/g-base';
import { Group } from '@antv/g-canvas';
import { getDataCellId } from 'src/utils/cell/data-cell';
import { get, maxBy, set, size } from 'lodash';
import { TableColHeader } from 'src/facet/header/table-col';
import { ColHeader } from 'src/facet/header/col';
import type {
  Formatter,
  LayoutResult,
  S2CellType,
  SplitLine,
  SpreadSheetFacetCfg,
  ViewMeta,
} from '../common/interface';
import {
  calculateFrozenCornerCells,
  calculateInViewIndexes,
  getFrozenDataCellType,
  splitInViewIndexesWithFrozen,
  translateGroup,
  translateGroupX,
  translateGroupY,
  isFrozenTrailingCol,
  isFrozenTrailingRow,
} from './utils';
import { CornerBBox } from './bbox/cornerBBox';
import { S2Event, SERIES_NUMBER_FIELD } from '@/common/constant';
import { FrozenCellGroupMap } from '@/common/constant/frozen';
import { DebuggerUtil } from '@/common/debug';
import { BaseFacet } from '@/facet/base-facet';
import { buildHeaderHierarchy } from '@/facet/layout/build-header-hierarchy';
import { Hierarchy } from '@/facet/layout/hierarchy';
import { layoutCoordinate } from '@/facet/layout/layout-hooks';
import { Node } from '@/facet/layout/node';
import { renderLine } from '@/utils/g-renders';
import { TableDataSet } from '@/data-set';
import { PanelIndexes } from '@/utils/indexes';
import { measureTextWidth, measureTextWidthRoughly } from '@/utils/text';

export class TableFacet extends BaseFacet {
  public constructor(cfg: SpreadSheetFacetCfg) {
    super(cfg);

    const s2 = this.spreadsheet;
    s2.on(S2Event.RANGE_SORT, ({ sortKey, sortMethod, sortBy }) => {
      set(s2.dataCfg, 'sortParams', [
        {
          sortFieldId: sortKey,
          sortMethod,
          sortBy,
        },
      ]);
      s2.setDataCfg(s2.dataCfg);
      s2.render(true);
      s2.emit(
        S2Event.RANGE_SORTED,
        (s2.dataSet as TableDataSet).getDisplayDataSet(),
      );
    });

    s2.on(S2Event.RANGE_FILTER, (params) => {
      /** remove filter params on current key if passed an empty filterValues field */
      const unFilter =
        !params.filteredValues || params.filteredValues.length === 0;

      const oldConfig = s2.dataCfg.filterParams || [];
      // check whether filter condition already exists on column, if so, modify it instead.
      const oldIndex = oldConfig.findIndex(
        (item) => item.filterKey === params.filterKey,
      );

      if (oldIndex !== -1) {
        if (unFilter) {
          // remove filter params on current key if passed an empty filterValues field
          oldConfig.splice(oldIndex);
        } else {
          // if filter with same key already exists, replace it
          oldConfig[oldIndex] = params;
        }
      } else {
        oldConfig.push(params);
      }

      set(s2.dataCfg, 'filterParams', oldConfig);

      s2.render(true);
      s2.emit(
        S2Event.RANGE_FILTERED,
        (s2.dataSet as TableDataSet).getDisplayDataSet(),
      );
    });
  }

  get colCellTheme() {
    return this.spreadsheet.theme.colCell.cell;
  }

  protected calculateCornerBBox() {
    const { colsHierarchy } = this.layoutResult;
    const height = Math.floor(colsHierarchy.height);

    this.cornerBBox = new CornerBBox(this);

    this.cornerBBox.height = height;
    this.cornerBBox.maxY = height;
  }

  public destroy() {
    super.destroy();
    this.spreadsheet.off(S2Event.RANGE_SORT);
    this.spreadsheet.off(S2Event.RANGE_FILTER);
  }

  private saveInitColumnNodes(columnNodes: Node[] = []) {
    const { store, dataCfg } = this.spreadsheet;
    const { columns = [] } = dataCfg.fields;
    const lastRenderedColumnFields = store.get('lastRenderedColumnFields');
    // 透视表切换为明细表 dataCfg 的 columns 配置改变等场景 需要重新保存初始布局节点
    const isDifferenceColumns =
      lastRenderedColumnFields &&
      size(lastRenderedColumnFields) !== size(columns);

    if (!store.get('initColumnNodes') || isDifferenceColumns) {
      store.set('initColumnNodes', columnNodes);
      store.set('lastRenderedColumnFields', columns);
    }
  }

  protected doLayout(): LayoutResult {
    const {
      dataSet,
      spreadsheet,
      cellCfg,
      frozenTrailingColCount,
      frozenTrailingRowCount,
    } = this.cfg;

    const rowsHierarchy = new Hierarchy();
    const { leafNodes: colLeafNodes, hierarchy: colsHierarchy } =
      buildHeaderHierarchy({
        isRowHeader: false,
        facetCfg: this.cfg,
      });

    this.saveInitColumnNodes(colLeafNodes);
    this.calculateNodesCoordinate(colLeafNodes, colsHierarchy);

    const getCellMeta = (rowIndex: number, colIndex: number) => {
      const showSeriesNumber = this.getSeriesNumberWidth() > 0;
      const col = colLeafNodes[colIndex];
      const cellHeight =
        cellCfg.height +
        this.colCellTheme.padding?.top +
        this.colCellTheme.padding?.bottom;

      const cellRange = this.getCellRange();

      let data;

      const width = this.panelBBox.maxX;
      const colLength = colLeafNodes.length;

      let x = col.x;
      let y = cellHeight * rowIndex;

      if (
        isFrozenTrailingRow(rowIndex, cellRange.end, frozenTrailingRowCount)
      ) {
        y = this.panelBBox.maxY - (cellRange.end + 1 - rowIndex) * cellHeight;
      }

      if (isFrozenTrailingCol(colIndex, frozenTrailingColCount, colLength)) {
        x =
          width -
          colLeafNodes
            .slice(-(colLength - colIndex))
            .reduce((prev, item, idx) => {
              return prev + item.width;
            }, 0);
      }

      if (showSeriesNumber && col.field === SERIES_NUMBER_FIELD) {
        data = rowIndex + 1;
      } else {
        data = dataSet.getCellData({
          query: {
            col: col.field,
            rowIndex,
          },
        });
      }
      return {
        spreadsheet,
        x,
        y,
        width: col.width,
        height: cellHeight,
        data: {
          [col.field]: data,
        },
        rowIndex,
        colIndex,
        isTotals: false,
        colId: col.id,
        rowId: String(rowIndex),
        valueField: col.field,
        fieldValue: data,
        id: getDataCellId(String(rowIndex), col.id),
      } as ViewMeta;
    };

    const layoutResult = {
      colNodes: colsHierarchy.getNodes(),
      colsHierarchy,
      rowNodes: rowsHierarchy.getNodes(),
      rowsHierarchy,
      rowLeafNodes: rowsHierarchy.getLeaves(),
      colLeafNodes,
      getCellMeta,
      spreadsheet,
    } as LayoutResult;

    return layoutResult;
  }

  private calculateNodesCoordinate(
    colLeafNodes: Node[],
    colsHierarchy: Hierarchy,
  ) {
    this.calculateColWidth(colLeafNodes);
    this.calculateColNodesCoordinate(colLeafNodes, colsHierarchy);
  }

  private getAdaptiveColWidth(colLeafNodes: Node[]) {
    const { cellCfg } = this.cfg;
    const colHeaderColSize = colLeafNodes.length;
    const canvasW = this.getCanvasHW().width;
    const size = Math.max(1, colHeaderColSize);
    return Math.max(cellCfg.width, canvasW / size);
  }

  private calculateColWidth(colLeafNodes: Node[]) {
    const { rowCfg, cellCfg } = this.cfg;
    let colWidth;
    if (this.spreadsheet.isColAdaptive()) {
      colWidth = this.getAdaptiveColWidth(colLeafNodes);
    } else {
      colWidth = -1;
    }

    rowCfg.width = colWidth;
    cellCfg.width = colWidth;
  }

  private getColNodeHeight(col: Node) {
    const { colCfg } = this.cfg;
    // 明细表所有列节点高度保持一致
    const userDragHeight = Object.values(get(colCfg, `heightByField`))[0];
    return userDragHeight || colCfg.height;
  }

  private calculateColNodesCoordinate(
    colLeafNodes: Node[],
    colsHierarchy: Hierarchy,
  ) {
    const { frozenTrailingColCount } = this.spreadsheet?.options;
    let preLeafNode = Node.blankNode();
    const allNodes = colsHierarchy.getNodes();
    for (const levelSample of colsHierarchy.sampleNodesForAllLevels) {
      levelSample.height = this.getColNodeHeight(levelSample);
      colsHierarchy.height += levelSample.height;
    }

    const nodes = [];

    for (let i = 0; i < allNodes.length; i++) {
      const currentNode = allNodes[i];

      currentNode.colIndex = i;
      currentNode.x = preLeafNode.x + preLeafNode.width;
      currentNode.width = this.calculateColLeafNodesWidth(currentNode);
      preLeafNode = currentNode;
      currentNode.y = 0;

      currentNode.height = this.getColNodeHeight(currentNode);

      nodes.push(currentNode);

      if (frozenTrailingColCount === 0) {
        layoutCoordinate(this.cfg, null, currentNode);
      }
      colsHierarchy.width += currentNode.width;
    }

    preLeafNode = Node.blankNode();

    let canvasW = this.getCanvasHW().width;
    canvasW = canvasW >= colsHierarchy.width ? colsHierarchy.width : canvasW;

    if (frozenTrailingColCount > 0) {
      for (let i = 1; i <= allNodes.length; i++) {
        const currentNode = allNodes[allNodes.length - i];

        if (
          currentNode.colIndex >=
          colLeafNodes.length - frozenTrailingColCount
        ) {
          if (currentNode.colIndex === allNodes.length - 1) {
            currentNode.x = canvasW - currentNode.width;
          } else {
            currentNode.x = preLeafNode.x - currentNode.width;
          }
          preLeafNode = currentNode;
        }

        layoutCoordinate(this.cfg, null, currentNode);
      }
    }
  }

  private calculateColLeafNodesWidth(col: Node): number {
    const { cellCfg, colCfg, dataSet, spreadsheet } = this.cfg;

    const userDragWidth = get(
      get(colCfg, 'widthByFieldValue'),
      `${col.value}`,
      col.width,
    );
    let colWidth;
    if (userDragWidth) {
      colWidth = userDragWidth;
    } else if (cellCfg.width === -1) {
      const datas = dataSet.getDisplayDataSet();
      const colLabel = col.label;

      const allLabels =
        datas?.map((data) => `${data[col.key]}`)?.slice(0, 50) || []; // 采样取了前50
      allLabels.push(colLabel);
      const maxLabel = maxBy(allLabels, (label) =>
        measureTextWidthRoughly(label),
      );

      const seriesNumberWidth = this.getSeriesNumberWidth();
      const {
        cell: colCellStyle,
        icon: colCellIconStyle,
        bolderText: colCellTextStyle,
      } = spreadsheet.theme.colCell;

      DebuggerUtil.getInstance().logger(
        'Max Label In Col:',
        col.field,
        maxLabel,
      );
      colWidth =
        measureTextWidth(maxLabel, colCellTextStyle) +
        colCellStyle.padding?.left +
        colCellStyle.padding?.right +
        colCellIconStyle.size;

      if (col.field === SERIES_NUMBER_FIELD) {
        colWidth = seriesNumberWidth;
      }
    } else {
      colWidth = cellCfg.width;
    }

    return colWidth;
  }

  protected getCellHeight() {
    const { cellCfg } = this.cfg;

    return (
      cellCfg.height +
      this.colCellTheme.padding?.top +
      this.colCellTheme.padding?.bottom
    );
  }

  protected getViewCellHeights() {
    const { dataSet } = this.cfg;

    const cellHeight = this.getCellHeight();

    return {
      getTotalHeight: () => {
        return cellHeight * dataSet.getDisplayDataSet().length;
      },

      getCellOffsetY: (offset: number) => {
        if (offset <= 0) return 0;
        let totalOffset = 0;
        for (let index = 0; index < offset; index++) {
          totalOffset += cellHeight;
        }
        return totalOffset;
      },

      getTotalLength: () => {
        return dataSet.getDisplayDataSet().length;
      },

      getIndexRange: (minHeight: number, maxHeight: number) => {
        const yMin = Math.floor(minHeight / cellHeight);
        // 防止数组index溢出导致报错
        const yMax =
          maxHeight % cellHeight === 0
            ? maxHeight / cellHeight - 1
            : Math.floor(maxHeight / cellHeight);
        return {
          start: yMin,
          end: yMax,
        };
      },
    };
  }

  protected initFrozenGroupPosition = () => {
    const { scrollY, scrollX } = this.getScrollOffset();
    const paginationScrollY = this.getPaginationScrollY();

    translateGroup(
      this.spreadsheet.frozenRowGroup,
      this.cornerBBox.width - scrollX,
      this.cornerBBox.height - paginationScrollY,
    );
    translateGroup(
      this.spreadsheet.frozenColGroup,
      this.cornerBBox.width,
      this.cornerBBox.height - scrollY - paginationScrollY,
    );
    translateGroup(
      this.spreadsheet.frozenTrailingColGroup,
      this.cornerBBox.width,
      this.cornerBBox.height - scrollY - paginationScrollY,
    );
    translateGroup(
      this.spreadsheet.frozenTopGroup,
      this.cornerBBox.width,
      this.cornerBBox.height - paginationScrollY,
    );
  };

  protected getTotalHeightForRange = (start: number, end: number) => {
    if (start < 0 || end < 0) return 0;
    let totalHeight = 0;
    for (let index = start; index < end + 1; index++) {
      const height = this.getCellHeight();
      totalHeight += height;
    }
    return totalHeight;
  };

  private getShadowFill = (angle: number) => {
    const style: SplitLine = get(this.cfg, 'spreadsheet.theme.splitLine');
    return `l (${angle}) 0:${style.shadowColors?.left} 1:${style.shadowColors?.right}`;
  };

  protected renderFrozenGroupSplitLine = () => {
    const {
      frozenRowCount,
      frozenColCount,
      frozenTrailingColCount,
      frozenTrailingRowCount,
    } = this.spreadsheet.options;
    const colLeafNodes = this.layoutResult.colLeafNodes;
    const dataLength = this.spreadsheet.dataSet.getMultiData({}).length;

    const style: SplitLine = get(this.cfg, 'spreadsheet.theme.splitLine');

    const verticalBorderStyle = {
      lineWidth: style?.verticalBorderWidth,
      stroke: style?.verticalBorderColor,
      opacity: style?.verticalBorderColorOpacity,
    };

    const horizontalBorderStyle = {
      lineWidth: style?.horizontalBorderWidth,
      stroke: style?.horizontalBorderColor,
      opacity: style?.horizontalBorderColorOpacity,
    };

    if (frozenColCount > 0) {
      const x = colLeafNodes.reduce((prev, item, idx) => {
        if (idx < frozenColCount) {
          return prev + item.width;
        }
        return prev;
      }, 0);

      renderLine(
        this.foregroundGroup as Group,
        {
          x1: x,
          x2: x,
          y1: this.cornerBBox.height,
          y2: this.panelBBox.maxY,
        },
        {
          ...verticalBorderStyle,
        },
      );

      if (style.showShadow) {
        this.foregroundGroup.addShape('rect', {
          attrs: {
            x,
            y: this.cornerBBox.height,
            width: style.shadowWidth,
            height: this.panelBBox.maxY - this.cornerBBox.height,
            fill: this.getShadowFill(0),
          },
        });
      }
    }

    if (frozenRowCount > 0) {
      const y =
        this.cornerBBox.height +
        this.getTotalHeightForRange(0, frozenRowCount - 1);
      renderLine(
        this.foregroundGroup as Group,
        {
          x1: 0,
          x2: this.panelBBox.width,
          y1: y,
          y2: y,
        },
        {
          ...horizontalBorderStyle,
        },
      );

      if (style.showShadow) {
        this.foregroundGroup.addShape('rect', {
          attrs: {
            x: 0,
            y: y,
            width: this.panelBBox.width,
            height: style.shadowWidth,
            fill: this.getShadowFill(90),
          },
        });
      }
    }

    if (frozenTrailingColCount > 0) {
      const width = colLeafNodes.reduceRight((prev, item, idx) => {
        if (idx >= colLeafNodes.length - frozenTrailingColCount) {
          return prev + item.width;
        }
        return prev;
      }, 0);

      const x = this.panelBBox.width - width;

      renderLine(
        this.foregroundGroup as Group,
        {
          x1: x,
          x2: x,
          y1: this.cornerBBox.height,
          y2: this.panelBBox.maxY,
        },
        {
          ...verticalBorderStyle,
        },
      );

      if (style.showShadow) {
        this.foregroundGroup.addShape('rect', {
          attrs: {
            x: x - style.shadowWidth,
            y: this.cornerBBox.height,
            width: style.shadowWidth,
            height: this.panelBBox.maxY - this.cornerBBox.height,
            fill: this.getShadowFill(180),
          },
        });
      }
    }

    if (frozenTrailingRowCount > 0) {
      const y =
        this.panelBBox.maxY -
        this.getTotalHeightForRange(
          dataLength - frozenTrailingRowCount,
          dataLength - 1,
        );
      renderLine(
        this.foregroundGroup as Group,
        {
          x1: 0,
          x2: this.panelBBox.width,
          y1: y,
          y2: y,
        },
        {
          ...horizontalBorderStyle,
        },
      );

      if (style.showShadow) {
        this.foregroundGroup.addShape('rect', {
          attrs: {
            x: 0,
            y: y - style.shadowWidth,
            width: this.panelBBox.width,
            height: style.shadowWidth,
            fill: this.getShadowFill(270),
          },
        });
      }
    }
  };

  protected renderFrozenPanelCornerGroup = () => {
    const {
      frozenRowCount,
      frozenColCount,
      frozenTrailingRowCount,
      frozenTrailingColCount,
    } = this.spreadsheet.options;

    const colLength = this.layoutResult.colLeafNodes.length;
    const cellRange = this.getCellRange();

    const result = calculateFrozenCornerCells(
      {
        frozenRowCount,
        frozenColCount,
        frozenTrailingRowCount,
        frozenTrailingColCount,
      },
      colLength,
      cellRange,
    );

    Object.keys(result).forEach((key) => {
      const cells = result[key];
      const group = this.spreadsheet[FrozenCellGroupMap[key]];
      if (group) {
        cells.forEach((cell) => {
          this.addFrozenCell(cell.x, cell.y, group);
        });
      }
    });
  };

  addFrozenCell = (colIndex: number, rowIndex: number, group: IGroup) => {
    const viewMeta = this.layoutResult.getCellMeta(rowIndex, colIndex);
    if (viewMeta) {
      const cell = this.cfg.dataCell(viewMeta);
      group.add(cell);
    }
  };

  addCell = (cell: S2CellType<ViewMeta>) => {
    const {
      frozenRowCount,
      frozenColCount,
      frozenTrailingRowCount,
      frozenTrailingColCount,
    } = this.spreadsheet.options;
    const colLength = this.layoutResult.colsHierarchy.getLeaves().length;
    const cellRange = this.getCellRange();

    const frozenCellType = getFrozenDataCellType(
      cell.getMeta(),
      {
        frozenRowCount,
        frozenColCount,
        frozenTrailingRowCount,
        frozenTrailingColCount,
      },
      colLength,
      cellRange,
    );

    const group = FrozenCellGroupMap[frozenCellType];
    if (group) {
      (this.spreadsheet[group] as Group).add(cell);
    }
  };

  public init() {
    super.init();
    const { width, height } = this.panelBBox;
    this.spreadsheet.panelGroup.setClip({
      type: 'rect',
      attrs: {
        x: 0,
        y: this.cornerBBox.height,
        width,
        height,
      },
    });
  }

  protected getColHeader(): ColHeader {
    if (!this.columnHeader) {
      const { x, width, height } = this.panelBBox;
      return new TableColHeader({
        width,
        height: this.cornerBBox.height,
        viewportWidth: width,
        viewportHeight: height,
        cornerWidth: this.cornerBBox.width,
        position: { x, y: 0 },
        data: this.layoutResult.colNodes,
        scrollContainsRowHeader:
          this.cfg.spreadsheet.isScrollContainsRowHeader(),
        formatter: (field: string): Formatter =>
          this.cfg.dataSet.getFieldFormatter(field),
        sortParam: this.cfg.spreadsheet.store.get('sortParam'),
        spreadsheet: this.spreadsheet,
      });
    }
    return this.columnHeader;
  }

  public render() {
    super.render();
    this.renderFrozenPanelCornerGroup();
    this.initFrozenGroupPosition();
    this.renderFrozenGroupSplitLine();
  }

  protected translateRelatedGroups(
    scrollX: number,
    scrollY: number,
    hRowScroll: number,
  ) {
    translateGroupX(
      this.spreadsheet.frozenRowGroup,
      this.cornerBBox.width - scrollX,
    );
    translateGroupX(
      this.spreadsheet.frozenTrailingRowGroup,
      this.cornerBBox.width - scrollX,
    );
    translateGroupY(
      this.spreadsheet.frozenColGroup,
      this.cornerBBox.height - scrollY,
    );
    translateGroupY(
      this.spreadsheet.frozenTrailingColGroup,
      this.cornerBBox.height - scrollY,
    );

    super.translateRelatedGroups(scrollX, scrollY, hRowScroll);
  }

  protected calculateXYIndexes(scrollX: number, scrollY: number): PanelIndexes {
    const {
      frozenColCount,
      frozenRowCount,
      frozenTrailingColCount,
      frozenTrailingRowCount,
    } = this.spreadsheet.options;

    const colLength = this.layoutResult.colLeafNodes.length;

    const indexes = calculateInViewIndexes(
      scrollX,
      scrollY,
      this.viewCellWidths,
      this.viewCellHeights,
      this.panelBBox,
      this.getRealScrollX(this.cornerBBox.width),
    );

    const cellRange = this.getCellRange();

    return splitInViewIndexesWithFrozen(
      indexes,
      {
        frozenColCount,
        frozenRowCount,
        frozenTrailingColCount,
        frozenTrailingRowCount,
      },
      colLength,
      cellRange,
    );
  }

  // 对 panelScrollGroup 以及四个方向的 frozenGroup 做 Clip，避免有透明度时冻结分组和滚动分组展示重叠
  protected clip(scrollX: number, scrollY: number) {
    const paginationScrollY = this.getPaginationScrollY();
    const {
      frozenRowGroup,
      frozenColGroup,
      frozenTrailingColGroup,
      frozenTrailingRowGroup,
      panelScrollGroup,
    } = this.spreadsheet;
    const frozenColGroupWidth = frozenColGroup.getBBox().width;
    const frozenRowGroupHeight = frozenRowGroup.getBBox().height;
    const frozenTrailingColBBox = frozenTrailingColGroup.getBBox();
    const frozenTrailingRowGroupHeight =
      frozenTrailingRowGroup.getBBox().height;
    const panelScrollGroupWidth =
      this.panelBBox.width -
      frozenColGroupWidth -
      frozenTrailingColGroup.getBBox().width;
    const panelScrollGroupHeight =
      this.panelBBox.height -
      frozenRowGroupHeight -
      frozenTrailingRowGroupHeight;

    panelScrollGroup.setClip({
      type: 'rect',
      attrs: {
        x: scrollX + frozenColGroupWidth,
        y: scrollY + frozenRowGroupHeight,
        width: panelScrollGroupWidth,
        height: panelScrollGroupHeight,
      },
    });

    frozenRowGroup.setClip({
      type: 'rect',
      attrs: {
        x: scrollX + frozenColGroupWidth,
        y: paginationScrollY,
        width: panelScrollGroupWidth,
        height: frozenRowGroupHeight,
      },
    });

    frozenTrailingRowGroup.setClip({
      type: 'rect',
      attrs: {
        x: scrollX + frozenColGroupWidth,
        y: frozenTrailingRowGroup.getBBox().minY,
        width: panelScrollGroupWidth,
        height: frozenTrailingRowGroupHeight,
      },
    });

    frozenColGroup.setClip({
      type: 'rect',
      attrs: {
        x: 0,
        y: scrollY + frozenRowGroupHeight,
        width: frozenColGroupWidth,
        height: panelScrollGroupHeight,
      },
    });

    frozenTrailingColGroup.setClip({
      type: 'rect',
      attrs: {
        x: frozenTrailingColBBox.minX,
        y: scrollY + frozenRowGroupHeight,
        width: frozenTrailingColBBox.width,
        height: panelScrollGroupHeight,
      },
    });
  }
}
