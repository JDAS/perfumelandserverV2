const path = require("path");

function loadWithMocks(targetRelativePath, mockMap = {}) {
  const targetPath = path.resolve(__dirname, "..", "..", targetRelativePath);
  const resolvedMocks = new Map();
  const originalEntries = new Map();

  for (const [request, mockExports] of Object.entries(mockMap)) {
    const mockPath = require.resolve(request, {
      paths: [path.dirname(targetPath)],
    });

    resolvedMocks.set(mockPath, mockExports);
    originalEntries.set(mockPath, require.cache[mockPath]);

    require.cache[mockPath] = {
      id: mockPath,
      filename: mockPath,
      loaded: true,
      exports: mockExports,
    };
  }

  const originalTarget = require.cache[targetPath];
  delete require.cache[targetPath];

  try {
    return require(targetPath);
  } finally {
    delete require.cache[targetPath];

    if (originalTarget) {
      require.cache[targetPath] = originalTarget;
    }

    for (const [mockPath] of resolvedMocks) {
      const originalEntry = originalEntries.get(mockPath);
      if (originalEntry) {
        require.cache[mockPath] = originalEntry;
      } else {
        delete require.cache[mockPath];
      }
    }
  }
}

module.exports = {
  loadWithMocks,
};
