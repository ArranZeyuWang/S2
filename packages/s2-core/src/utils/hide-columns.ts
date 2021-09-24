import { compact, isEqual, last, uniq } from 'lodash';
import { HiddenColumnsInfo } from '@/common/interface/store';
import { SpreadSheet } from '@/sheet-type';
import { S2Event } from '@/common/constant';
import { Node } from '@/facet/layout/node';

/**
 * @name  获取需要隐藏的 filed 转成对应的 Node
 */
export const getHiddenColumnNodes = (
  spreadsheet: SpreadSheet,
  hiddenColumnFields: string[] = [],
): Node[] => {
  const columnNodes = spreadsheet.getInitColumnNodes();
  return compact(
    hiddenColumnFields.map((filed) =>
      columnNodes.find((node) => node.field === filed),
    ),
  );
};

/**
 * @name 获取隐藏列兄弟节点
 * @description 获取当前隐藏列(兼容多选) 所对应为未隐藏的兄弟节点, 如果是尾节点被隐藏, 则返回他的前一个兄弟节点
 * @param hideColumns 经过分组的连续隐藏列
   [ 1, 2, 3, -, -, -, (7 √), 8, 9 ]
  [ 1, 2, 3, (4 √), - ]
 */
export const getHiddenColumnDisplaySiblingNode = (
  spreadsheet: SpreadSheet,
  hiddenColumnFields: string[] = [],
): Node => {
  const initColumnNodes = spreadsheet.getInitColumnNodes();
  const hiddenColumnIndexes = getHiddenColumnNodes(
    spreadsheet,
    hiddenColumnFields,
  ).map((node) => node?.colIndex);
  const lastHiddenColumnIndex = Math.max(...hiddenColumnIndexes);
  const firstHiddenColumnIndex = Math.min(...hiddenColumnIndexes);
  const nextSiblingNode = initColumnNodes.find(
    (node) => node.colIndex === lastHiddenColumnIndex + 1,
  );
  const prevSiblingNode = initColumnNodes.find(
    (node) => node.colIndex === firstHiddenColumnIndex - 1,
  );
  return nextSiblingNode ?? prevSiblingNode;
};

/**
 * @name 获取隐藏列组
 * @description 如果给定的隐藏列不是连续的, 比如原始例是 [1,2,3,4,5,6,7], 隐藏列是 [2,3,6], 那么其实在表格上需要显示两个展开按钮
   [[2,3],[6]]
 */
export const getHiddenColumnsThunkGroup = (
  columns: string[],
  hiddenColumnFields: string[],
): string[][] => {
  // 上一个需要隐藏项的序号
  let prevHiddenIndex = Number.NEGATIVE_INFINITY;
  return columns.reduce((result, field, index) => {
    if (!hiddenColumnFields.includes(field)) {
      return result;
    }
    if (index === prevHiddenIndex + 1) {
      const lastGroup = last(result);
      lastGroup.push(field);
    } else {
      const group = [field];
      result.push(group);
    }
    prevHiddenIndex = index;
    return result;
  }, []);
};

/**
 * @name 隐藏指定列
 * @description 1. 通过分析组件隐藏, 2. 点击列头隐藏
   存储: 1.隐藏列所对应的兄弟节点 (显示展开按钮), 2.当前隐藏列 (点击展开按钮恢复隐藏)
   重置交互: 比如选中当前列, 显示高亮背景色, 隐藏后需要取消高亮
   钩子: 提供当前被隐藏的列, 和全量的隐藏组
 */
export const hideColumns = (
  spreadsheet: SpreadSheet,
  selectedColumnFields: string[] = [],
) => {
  const { hiddenColumnFields: lastHiddenColumnFields } = spreadsheet.options;
  if (isEqual(selectedColumnFields, lastHiddenColumnFields)) {
    return;
  }
  const hiddenColumnFields: string[] = uniq([
    ...selectedColumnFields,
    ...lastHiddenColumnFields,
  ]);
  spreadsheet.setOptions({
    hiddenColumnFields,
  });
  const displaySiblingNode = getHiddenColumnDisplaySiblingNode(
    spreadsheet,
    selectedColumnFields,
  );

  const lastHiddenColumnDetail = spreadsheet.store.get(
    'hiddenColumnsDetail',
    [],
  );

  const currentHiddenColumnsInfo: HiddenColumnsInfo = {
    hideColumnNodes: getHiddenColumnNodes(spreadsheet, selectedColumnFields),
    displaySiblingNode,
  };

  const hiddenColumnsDetail: HiddenColumnsInfo[] = [
    ...lastHiddenColumnDetail,
    currentHiddenColumnsInfo,
  ];

  spreadsheet.emit(
    S2Event.LAYOUT_TABLE_COL_HIDE,
    currentHiddenColumnsInfo,
    hiddenColumnsDetail,
  );
  spreadsheet.store.set('hiddenColumnsDetail', hiddenColumnsDetail);
  spreadsheet.interaction.reset();
  spreadsheet.render(false);
};

export const isLastColumnAfterHidden = (
  spreadsheet: SpreadSheet,
  columnField: string,
) => {
  const columnNodes = spreadsheet.getColumnNodes();
  const initColumnNodes = spreadsheet.getInitColumnNodes();
  return (
    last(columnNodes).field === columnField &&
    last(initColumnNodes).field !== columnField
  );
};