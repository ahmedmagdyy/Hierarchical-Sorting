const { argv } = require("node:process");
const fs = require("fs");

const TOTAL_SIGN = "$total";
const COLUMN_SEPERATOR = "|";
const LINE_SEPERATOR = "\n";

function hierarchicalSort(rows, sortColumnName) {
  // console.log({ rows, sortColumnName });
  const rowsCopy = rows;
  const lengthOfRows = rowsCopy.length;
  let rowsContainsTotalProp = [rowsCopy[0]];
  let nestedProperties = [];
  const rowsWithoutTotalProp = new Map();

  const sortColumnIndex = rowsCopy[0]
    .split(COLUMN_SEPERATOR)
    .indexOf(sortColumnName);

  let metricsNumber = 0;

  // get count of properties and metric columns
  const propertiesNumber = rowsCopy[0]
    .split(COLUMN_SEPERATOR)
    .reduce((prev, acc) => {
      if (acc.includes("property")) {
        prev = prev + 1;
      } else {
        metricsNumber += 1;
      }
      return prev;
    }, 0);
  console.log({ propertiesNumber, metricsNumber });

  // 0 is header so we start from 1
  for (let i = 1; i < lengthOfRows; i++) {
    const singleRow = rowsCopy[i];
    const currentRow = singleRow.split(COLUMN_SEPERATOR);
    // extract rows have total property
    if (singleRow.includes(TOTAL_SIGN)) {
      if (!rowsContainsTotalProp[1]) {
        rowsContainsTotalProp.push(singleRow);
      } else {
        // compare rowsContainsTotalProp[1] with current to check if $total/$total not placed as second record
        const firstRow = rowsContainsTotalProp[1].split(COLUMN_SEPERATOR);
        if (currentRow[0] === TOTAL_SIGN && firstRow[0] !== TOTAL_SIGN) {
          const temp = firstRow;
          rowsContainsTotalProp[1] = singleRow;
          rowsContainsTotalProp.push(temp.join(COLUMN_SEPERATOR));
        } else {
          rowsContainsTotalProp.push(singleRow);
        }
      }
    }

    // create array of nested properties / categories -> womens footwear|shoes
    // extract rows have nested properties but not total property
    if (!singleRow.includes(TOTAL_SIGN)) {
      const itemName = currentRow
        .slice(0, propertiesNumber - 1)
        .join(COLUMN_SEPERATOR);
      if (rowsWithoutTotalProp.has(itemName)) {
        rowsWithoutTotalProp.set(itemName, [
          ...rowsWithoutTotalProp.get(itemName),
          singleRow,
        ]);
      } else {
        nestedProperties.push(itemName);
        rowsWithoutTotalProp.set(itemName, [singleRow]);
      }
    }
  }

  console.log(
    "rowsContainsTotalProp before sorting using sortColumnName",
    rowsContainsTotalProp
  );
  // sort items by metric column
  rowsContainsTotalProp.sort(
    (a, b) =>
      b.split(COLUMN_SEPERATOR)[sortColumnIndex] -
      a.split(COLUMN_SEPERATOR)[sortColumnIndex]
  );
  console.log("rowsContainsTotalProp after sorting using sortColumnName", {
    rowsContainsTotalProp,
  });
  console.dir({ rowsWithoutTotalProp }, { depth: null });

  // get every property and its level in rowsContainsTotalProp
  // 0 for header, 1 for $total/$total
  let level = 2;
  const categorizeItemsBasedOnNestedProps = new Map();
  for (let i = 2; i < rowsContainsTotalProp.length; i++) {
    const row = rowsContainsTotalProp[i].split(COLUMN_SEPERATOR);
    const property = row[0];
    if (categorizeItemsBasedOnNestedProps.has(property)) continue;
    categorizeItemsBasedOnNestedProps.set(property, level);
    level += 1;
  }
  console.log({ categorizeItemsBasedOnNestedProps });

  // get every record starts with nestedProperty[i] and insert it to its section in rowsContainsTotalProp
  const sortedItems = [rowsContainsTotalProp[0], rowsContainsTotalProp[1]];
  for (let i = 2; i < rowsContainsTotalProp.length; i++) {
    const rowsContainsTotalPropRow =
      rowsContainsTotalProp[i].split(COLUMN_SEPERATOR);
    if (rowsContainsTotalPropRow[1] === TOTAL_SIGN) continue;
    const property = `${rowsContainsTotalPropRow[0]}|${rowsContainsTotalPropRow[1]}`;
    const childrens = rowsWithoutTotalProp.get(property);
    // sort childrens based on metric column
    if (childrens.length) {
      childrens.sort(
        (a, b) =>
          b.split(COLUMN_SEPERATOR)[sortColumnIndex] -
          a.split(COLUMN_SEPERATOR)[sortColumnIndex]
      );
    }
    // console.log({ childrens });
    sortedItems.push(rowsContainsTotalProp[i], ...childrens);
  }
  console.log({ sortedItems });
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
// write rowsContainsTotalProp to output file.csv & .txt
// TODO: try to sort in place
