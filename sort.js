const { argv } = require("node:process");
const fs = require("fs");
const path = require("node:path");

const TOTAL_SIGN = "$total";
const COLUMN_SEPERATOR = "|";
const LINE_SEPERATOR = "\n";

class Node {
  constructor({
    category = null,
    hashMap = new Map(), // to save childrens
    metrics = [],
    // sortMetricValue = 0,
    subCategorties = [],
    parentNode = null,
    fullPath = "",
    depth = 0,
  }) {
    this.category = category;
    this.hashMap = hashMap;
    this.metrics = metrics;
    // this.sortMetricValue = sortMetricValue;
    this.subCategorties = subCategorties;
    this.parentNode = parentNode;
    this.fullPath = fullPath;
    this.depth = depth;
  }
}

function hierarchicalSort(rows, sortColumnName) {
  const rowsCopy = rows;
  const sortColumnIndex =
    rowsCopy[0].split(COLUMN_SEPERATOR).indexOf(sortColumnName) + 1;
  const header = [rowsCopy[0]];
  const headerSplitted = rowsCopy[0].split(COLUMN_SEPERATOR);

  const propertiesCount = headerSplitted.reduce((prev, headerProperty) => {
    headerProperty.includes("property") ? prev++ : prev;
    return prev;
  }, 0);
  const merticsCount = headerSplitted.slice(propertiesCount).length;

  // split each line into array of items
  const rowsSplitted = rowsCopy.reduce((prev, row) => {
    // to skip first row and empty rows
    if (!row.includes("property") && !!row) {
      prev.push(row.split(COLUMN_SEPERATOR));
    }
    // add line start with $total to header array
    if (row.startsWith(TOTAL_SIGN)) header.push(row);
    return prev;
  }, []);

  const treeRootNode = createTree({
    rowsSplitted,
    propertiesCount,
    merticsCount,
  });

  return dfs({
    root: treeRootNode,
    header,
    sortColumnIndex,
    propertiesCount,
  });
}

function createTree({ rowsSplitted, propertiesCount, merticsCount }) {
  // for each item in each row create a Node
  const rootNode = new Node({});
  // O(N * M)
  // N rowsSplitted length
  // M propertiesCount - 1
  rowsSplitted.forEach((row) => {
    let currentParent = rootNode; // set to root to search for categories - avoid adding duplicate categories
    let categoryLevel = 1;
    for (let index = 0; index < propertiesCount; index++) {
      const item = row[index];
      if (item === TOTAL_SIGN) {
        currentParent.metrics = row.slice(row.length - merticsCount);
        break;
      }
      const categoryExists = currentParent.hashMap.get(item);
      if (!categoryExists) {
        const initNewItemNode = new Node({
          category: item,
          hashMap: new Map(),
          metrics:
            index + 1 === propertiesCount
              ? row.slice(row.length - merticsCount)
              : [],
          // sortMetricValue:
          //   index + 1 === propertiesCount ? row[sortColumnIndex - 1] : 0,
          subCategorties: [],
          parentNode: currentParent,
          fullPath: currentParent.fullPath
            ? currentParent.fullPath + COLUMN_SEPERATOR + item
            : item,
          depth: categoryLevel,
        });
        currentParent.hashMap.set(item, initNewItemNode); // add new node to hashmap of parent node
        currentParent.subCategorties.push(initNewItemNode); // add to parent
        currentParent = initNewItemNode; // set new node as parent to insert subcategories
      } else {
        currentParent = categoryExists;
      }
      categoryLevel++;
    }
  });
  return rootNode;
}

function dfs({ root, header, sortColumnIndex, propertiesCount }) {
  // DFS
  // sort using stack
  // push root node to stack
  // while stack is not empty
  // take top of stack
  // sort childrens by metric value and push to top of stack
  // push node fullPath joined by '|' & '$total' based on depth to sortedItems array
  const stack = [root];
  const sortedItems = [...header];

  while (stack.length > 0) {
    const currentNode = stack.shift(); // top of stack
    currentNode.subCategorties.sort((a, b) => {
      return (
        a.metrics[sortColumnIndex - 1 - propertiesCount] -
        b.metrics[sortColumnIndex - 1 - propertiesCount]
      );
    });
    currentNode.subCategorties.forEach((subCategory) => {
      stack.unshift(subCategory); // push childrens to stack
    });
    if (currentNode.depth > 0) {
      sortedItems.push(
        [
          currentNode.fullPath,
          ...Array(propertiesCount - currentNode.depth).fill(TOTAL_SIGN),
          ...currentNode.metrics,
        ].join(COLUMN_SEPERATOR)
      );
    }
  }
  return sortedItems;
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
  console.log({ sortedData });

  writeToFile(outputFilename, sortedData.join(LINE_SEPERATOR));
  console.log(`${outputFilename} created!`);
}

main();
