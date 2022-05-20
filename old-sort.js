const { argv } = require("node:process");
const fs = require("fs");
const path = require("node:path");

const TOTAL_SIGN = "$total";
const COLUMN_SEPERATOR = "|";
const LINE_SEPERATOR = "\n";

function hierarchicalSort(rows, sortColumnName) {
  const rowsCopy = rows;
  const sortColumnIndex = rowsCopy[0]
    .split(COLUMN_SEPERATOR)
    .indexOf(sortColumnName);

  const {
    mainCategoriesWithTotal,
    rowsContainsNestedTotalProp,
    headerWithTotalProp,
    rowsWithoutTotalProp,
    propertiesCount,
  } = categorizeRowsBasedOnCategory(rowsCopy);

  // sort items by metric column
  rowsContainsNestedTotalProp.sort(
    (a, b) =>
      b.split(COLUMN_SEPERATOR)[sortColumnIndex] -
      a.split(COLUMN_SEPERATOR)[sortColumnIndex]
  );

  const sortedRowsBasedOnNameAndMetric = new Set();
  // sort rowsContainsNestedTotalProp based on category until first TOTAL_SIGN
  for (let i = 0; i < rowsContainsNestedTotalProp.length; i++) {
    const outerRow = rowsContainsNestedTotalProp[i]
      .split(COLUMN_SEPERATOR)
      .indexOf(TOTAL_SIGN);
    const fullCategory = rowsContainsNestedTotalProp[i]
      .split(COLUMN_SEPERATOR)
      .slice(0, outerRow)
      .join(COLUMN_SEPERATOR);
    sortedRowsBasedOnNameAndMetric.add(rowsContainsNestedTotalProp[i]);
    for (let j = 0; j < rowsContainsNestedTotalProp.length; j++) {
      const innerRow = rowsContainsNestedTotalProp[j]
        .split(COLUMN_SEPERATOR)
        .indexOf(TOTAL_SIGN);
      const innerFullCategory = rowsContainsNestedTotalProp[j]
        .split(COLUMN_SEPERATOR)
        .slice(0, innerRow)
        .join(COLUMN_SEPERATOR);
      if (innerFullCategory.includes(fullCategory) && i !== j) {
        sortedRowsBasedOnNameAndMetric.add(rowsContainsNestedTotalProp[j]);
      }
    }
  }

  mainCategoriesWithTotal.sort(
    (a, b) =>
      b.split(COLUMN_SEPERATOR)[sortColumnIndex] -
      a.split(COLUMN_SEPERATOR)[sortColumnIndex]
  );
  const mainCategories = getMainCategories(mainCategoriesWithTotal);

  // insert the header and $total rows
  const sortedItems = [...headerWithTotalProp];

  for (let i = 0; i < mainCategories.length; i++) {
    const mainCategoryName = mainCategories[i];
    sortedItems.push(mainCategoriesWithTotal[i]);
    if (sortedRowsBasedOnNameAndMetric.size) {
      sortedRowsBasedOnNameAndMetric.forEach((row) => {
        const rowHasNestedTotalProp = row.split(COLUMN_SEPERATOR);
        const category = rowHasNestedTotalProp[0];
        if (category === mainCategoryName) {
          if (
            rowHasNestedTotalProp
              .slice(0, propertiesCount - 1)
              .includes(TOTAL_SIGN)
          ) {
            sortedItems.push(row);
          } else {
            const property = rowHasNestedTotalProp
              .slice(0, propertiesCount - 1)
              .join(COLUMN_SEPERATOR);
            sortedItems.push(
              row,
              ...getChildrensByMainCategory(
                rowsWithoutTotalProp,
                property,
                sortColumnIndex
              )
            );
          }
        }
      });
    } else {
      // if we don't have any nested categories with total
      sortedItems.push(
        ...getChildrensByMainCategory(
          rowsWithoutTotalProp,
          mainCategoryName,
          sortColumnIndex
        )
      );
    }
  }
  return sortedItems;
}

function categorizeRowsBasedOnCategory(rows) {
  const rowsCopy = rows;
  const lengthOfRows = rowsCopy.length;

  const rowsContainsNestedTotalProp = [];
  const headerWithTotalProp = [rowsCopy[0]];
  const rowsWithoutTotalProp = new Map();
  const mainCategoriesWithTotal = [];

  // get count of properties and metric columns
  const propertiesCount = rowsCopy[0]
    .split(COLUMN_SEPERATOR)
    .reduce((prev, acc) => {
      if (acc.includes("property")) {
        prev = prev + 1;
      }
      return prev;
    }, 0);

  // 0 is header so we start from 1
  for (let i = 1; i < lengthOfRows; i++) {
    const singleRow = rowsCopy[i];
    const singleRowSplitted = singleRow.split(COLUMN_SEPERATOR);
    // extract rows have total property
    if (singleRow.includes(TOTAL_SIGN)) {
      if (singleRowSplitted[0] === TOTAL_SIGN) {
        headerWithTotalProp.push(singleRow);
      } else if (singleRowSplitted[1] === TOTAL_SIGN) {
        mainCategoriesWithTotal.push(singleRow);
      } else {
        rowsContainsNestedTotalProp.push(singleRow);
      }
    } else {
      // create array of nested properties / categories -> womens footwear|shoes
      // extract rows have nested properties but not total property
      const itemName = singleRowSplitted
        .slice(0, propertiesCount - 1)
        .join(COLUMN_SEPERATOR);
      if (rowsWithoutTotalProp.has(itemName)) {
        rowsWithoutTotalProp.set(itemName, [
          ...rowsWithoutTotalProp.get(itemName),
          singleRow,
        ]);
      } else {
        rowsWithoutTotalProp.set(itemName, [singleRow]);
      }
    }
  }
  return {
    rowsWithoutTotalProp,
    rowsContainsNestedTotalProp,
    mainCategoriesWithTotal,
    headerWithTotalProp,
    propertiesCount,
  };
}

function getChildrensByMainCategory(hashTable, category, sortColumnIndex) {
  const childrens = hashTable.get(category);
  // sort childrens based on metric column
  if (childrens.length) {
    childrens.sort(
      (a, b) =>
        b.split(COLUMN_SEPERATOR)[sortColumnIndex] -
        a.split(COLUMN_SEPERATOR)[sortColumnIndex]
    );
  }
  return childrens;
}

function getMainCategories(mainCategoriesWithTotal) {
  const categories = [];
  for (let i = 0; i < mainCategoriesWithTotal.length; i++) {
    const row = mainCategoriesWithTotal[i].split(COLUMN_SEPERATOR);
    const property = row[0];
    if (categories.includes(property)) continue;
    categories.push(property);
  }
  return categories;
}

function writeToFile(fileName, content) {
  fs.writeFileSync(fileName, content);
}

// calling it
function main() {
  const inputFilename = argv[2];
  const sortColumn = argv[3];
  const outputFilename = argv[4];

  const fileContent = fs.readFileSync(
    path.join(__dirname, inputFilename),
    "utf8"
  );
  const rows = fileContent.split(LINE_SEPERATOR);

  if (!rows[0].includes(sortColumn)) {
    console.log(
      "sort column not found in file header, please choose another column!"
    );
    return;
  }
  const sortedData = hierarchicalSort(rows, sortColumn);
  // console.log({ sortedData });

  // const outputFilename = `data_sorted.csv`;
  writeToFile(outputFilename, sortedData.join(LINE_SEPERATOR));
  console.log(`${outputFilename} created!`);
}

main();
