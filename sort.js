const { argv } = require("node:process");
const fs = require("fs");

const TOTAL_SIGN = "$total";
const COLUMN_SEPERATOR = "|";
const LINE_SEPERATOR = "\n";

function hierarchicalSort(rows, sortColumnName) {
  // console.log({ rows, sortColumnName });
  const rowsCopy = rows;
  const lengthOfRows = rowsCopy.length;

  let mainCategoriesWithTotal = [];
  let rowsContainsNestedTotalProp = [];
  let headerWithTotalProp = [rowsCopy[0]];
  const rowsWithoutTotalProp = new Map();

  const sortColumnIndex = rowsCopy[0]
    .split(COLUMN_SEPERATOR)
    .indexOf(sortColumnName);

  // get count of properties and metric columns
  const propertiesNumber = rowsCopy[0]
    .split(COLUMN_SEPERATOR)
    .reduce((prev, acc) => {
      if (acc.includes("property")) {
        prev = prev + 1;
      }
      return prev;
    }, 0);
  console.log({ propertiesNumber });

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
        .slice(0, propertiesNumber - 1)
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

  // sort items by metric column
  rowsContainsNestedTotalProp.sort(
    (a, b) =>
      b.split(COLUMN_SEPERATOR)[sortColumnIndex] -
      a.split(COLUMN_SEPERATOR)[sortColumnIndex]
  );
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
    if (rowsContainsNestedTotalProp.length) {
      for (let j = 0; j < rowsContainsNestedTotalProp.length; j++) {
        const rowHasNestedTotalProp =
          rowsContainsNestedTotalProp[j].split(COLUMN_SEPERATOR);
        const category = rowHasNestedTotalProp[0];
        if (category === mainCategoryName) {
          if (
            rowHasNestedTotalProp
              .slice(0, propertiesNumber - 1)
              .includes(TOTAL_SIGN)
          ) {
            sortedItems.push(rowsContainsNestedTotalProp[j]);
          } else {
            const property = rowHasNestedTotalProp
              .slice(0, propertiesNumber - 1)
              .join(COLUMN_SEPERATOR);
            sortedItems.push(
              rowsContainsNestedTotalProp[j],
              ...getChildrensByMainCategory(
                rowsWithoutTotalProp,
                property,
                sortColumnIndex
              )
            );
          }
        }
      }
    } else {
      sortedItems.push(
        ...getChildrensByMainCategory(
          rowsWithoutTotalProp,
          mainCategoryName,
          sortColumnIndex
        )
      );
    }
  }
  console.log({ sortedItems });
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

// calling it
function main() {
  const inputFilename = argv[2];
  const sortColumn = argv[3];

  const fileContent = fs.readFileSync(inputFilename, "utf8");
  const rows = fileContent.split(LINE_SEPERATOR);
  // console.log({
  //   inputFilename,
  //   sortColumn,
  //   rows,
  // });
  if (!rows[0].includes(sortColumn)) {
    console.log(
      "sort column not found in file header, please choose another column!"
    );
    return;
  }
  hierarchicalSort(rows, sortColumn);
}

main();

// run ts file arg[0] input file name, arg[1] sort column name
// parse text or csv file
// pass rows to hierarchicalSort
// sort rows by sort column arg[1]
// write rowsContainsNestedTotalProp to output file.csv & .txt
// TODO: try to sort in place
