document.addEventListener('DOMContentLoaded', function() {
  document.getElementById('saveTabs').addEventListener('click', saveTabs);
  document.getElementById('openTabs').addEventListener('click', openAllTabs);
  document.getElementById('deleteAllTabs').addEventListener('click', deleteAllTabs);
  document.getElementById('exportTabs').addEventListener('click', exportTabs); // Event listener for export button
  // document.getElementById('importTabs').addEventListener('click', importTabs); // Event listener for import button
  loadTabs();
});

function saveTabs() {
  chrome.runtime.sendMessage({ action: "saveTabs" }, function(response) {
    if (response.status === "success") {
      document.getElementById('status').textContent = "Tabs saved!";
      loadTabs(); // Reload tabs after saving
    } else {
      console.error("Error saving tabs:", response.message);
    }
  });
}

function loadTabs() {
  chrome.storage.local.get(['savedTabs'], function(result) {
    var windowsList = document.getElementById('windowsList');
    windowsList.innerHTML = ''; // Clear existing list

    if (result.savedTabs) {
      result.savedTabs.forEach(function(window) {
        var windowDiv = document.createElement('div');
        windowDiv.className = 'window';

        var windowTitle = document.createElement('h2');
        windowTitle.textContent = 'Window ' + window.windowId;

        var deleteWindowBtn = document.createElement('button');
        deleteWindowBtn.textContent = 'Delete Window';
        deleteWindowBtn.className = 'deleteBtn';
        deleteWindowBtn.addEventListener('click', function() {
          deleteWindow(window.windowId);
        });

        var openWindowBtn = document.createElement('button');
        openWindowBtn.textContent = 'Open Window';
        openWindowBtn.className = 'openBtn';
        openWindowBtn.addEventListener('click', function() {
          openWindow(window.windowId);
        });

        windowTitle.appendChild(deleteWindowBtn);
        windowTitle.appendChild(openWindowBtn);
        windowDiv.appendChild(windowTitle);

        var tabsList = document.createElement('ul');
        window.tabs.forEach(function(tab) {
          var li = createTabListItem(tab);
          tabsList.appendChild(li);
        });

        windowDiv.appendChild(tabsList);

        // Display grouped tabs
        for (var groupId in window.groups) {
          if (window.groups.hasOwnProperty(groupId)) {
            var group = window.groups[groupId];
            var groupDiv = document.createElement('div');
            groupDiv.className = 'group';

            var groupTitle = document.createElement('h3');
            groupTitle.textContent = group.title + ' (' + group.color + ')';
            groupDiv.appendChild(groupTitle);

            var groupTabsList = document.createElement('ul');
            group.tabs.forEach(function(tab, index) {
              var li = createTabListItem(tab, window.windowId, groupId, index);
              groupTabsList.appendChild(li);
            });

            groupDiv.appendChild(groupTabsList);
            windowDiv.appendChild(groupDiv);
          }
        }

        windowsList.appendChild(windowDiv);
      });
    }
  });
}

function createTabListItem(tab, windowId, groupId, tabIndex) {
  var li = document.createElement('li');
  var a = document.createElement('a');
  a.href = tab.url;
  a.textContent = tab.title || tab.url;
  a.target = '_blank';
  li.appendChild(a);

  var deleteBtn = document.createElement('button');
  deleteBtn.textContent = 'Delete';
  deleteBtn.className = 'deleteBtn';
  deleteBtn.addEventListener('click', function() {
    if (groupId !== undefined && tabIndex !== undefined) {
      deleteGroupTab(windowId, groupId, tabIndex);
    } else {
      deleteTab(tab.url);
    }
  });
  li.appendChild(deleteBtn);

  return li;
}

function deleteTab(tabUrl) {
  chrome.storage.local.get(['savedTabs'], function(result) {
    if (result.savedTabs) {
      result.savedTabs.forEach(function(window, windowIndex) {
        var tabIndex = window.tabs.findIndex(tab => tab.url === tabUrl);
        if (tabIndex !== -1) {
          result.savedTabs[windowIndex].tabs.splice(tabIndex, 1);
          if (result.savedTabs[windowIndex].tabs.length === 0) {
            result.savedTabs.splice(windowIndex, 1); // Remove the window if it has no tabs
          }
          chrome.storage.local.set({ savedTabs: result.savedTabs }, function() {
            loadTabs(); // Reload tabs after deleting
          });
        }
      });
    }
  });
}

function deleteGroupTab(windowId, groupId, tabIndex) {
  chrome.storage.local.get(['savedTabs'], function(result) {
    if (result.savedTabs) {
      var windowIndex = result.savedTabs.findIndex(window => window.windowId === windowId);
      if (windowIndex !== -1) {
        var group = result.savedTabs[windowIndex].groups[groupId];
        if (group) {
          group.tabs.splice(tabIndex, 1);
          if (group.tabs.length === 0) {
            delete result.savedTabs[windowIndex].groups[groupId];
          }
          chrome.storage.local.set({ savedTabs: result.savedTabs }, function() {
            loadTabs(); // Reload tabs after deleting
          });
        }
      }
    }
  });
}

function deleteWindow(windowId) {
  chrome.storage.local.get(['savedTabs'], function(result) {
    if (result.savedTabs) {
      var windowIndex = result.savedTabs.findIndex(window => window.windowId === windowId);
      if (windowIndex !== -1) {
        result.savedTabs.splice(windowIndex, 1); // Remove the entire window group
        chrome.storage.local.set({ savedTabs: result.savedTabs }, function() {
          loadTabs(); // Reload tabs after deleting the window
        });
      }
    }
  });
}

function openWindow(windowId) {
  chrome.storage.local.get(['savedTabs'], function(result) {
    if (result.savedTabs) {
      var windowInfo = result.savedTabs.find(window => window.windowId === windowId);
      if (windowInfo) {
        var tabsToCreate = [];

        // Collect all tab URLs from both tabs and groups
        windowInfo.tabs.forEach(tab => {
          tabsToCreate.push({ url: tab.url, groupId: null });
        });

        for (var groupId in windowInfo.groups) {
          if (windowInfo.groups.hasOwnProperty(groupId)) {
            var group = windowInfo.groups[groupId];
            group.tabs.forEach(tab => {
              tabsToCreate.push({ url: tab.url, groupId: parseInt(groupId) });
            });
          }
        }

        // Open a new Chrome window with the first tab to get the new window ID
        if (tabsToCreate.length > 0) {
          chrome.windows.create({ url: tabsToCreate[0].url }, function(newWindow) {
            if (chrome.runtime.lastError) {
              console.error("Error creating window:", chrome.runtime.lastError.message);
              return;
            }

            var newWindowId = newWindow.id;
            var createdTabIds = [];
            var tabCreationPromises = [];

            // Create remaining tabs in the new window
            for (var i = 1; i < tabsToCreate.length; i++) {
              var tabToCreate = tabsToCreate[i];
              tabCreationPromises.push(
                new Promise((resolve, reject) => {
                  chrome.tabs.create({ windowId: newWindowId, url: tabToCreate.url, active: false }, function(newTab) {
                    if (chrome.runtime.lastError) {
                      reject(chrome.runtime.lastError.message);
                    } else {
                      createdTabIds.push({ tabId: newTab.id, groupId: tabToCreate.groupId });
                      resolve();
                    }
                  });
                })
              );
            }

            Promise.all(tabCreationPromises)
              .then(() => {
                var tabsByGroup = {};

                // Collect tab IDs by groupId
                createdTabIds.forEach(createdTab => {
                  var groupId = createdTab.groupId;
                  if (groupId !== null) {
                    if (!tabsByGroup[groupId]) {
                      tabsByGroup[groupId] = [];
                    }
                    tabsByGroup[groupId].push(createdTab.tabId);
                  }
                });

                // Group tabs as needed
                var groupPromises = [];
                for (var groupId in tabsByGroup) {
                  if (tabsByGroup.hasOwnProperty(groupId)) {
                    var groupTabIds = tabsByGroup[groupId];

                    if (groupTabIds.length > 0) {
                      groupPromises.push(
                        new Promise((resolve, reject) => {
                          chrome.tabs.group({ tabIds: groupTabIds, createProperties: { windowId: newWindowId } }, function(newGroupId) {
                            if (chrome.runtime.lastError) {
                              reject(chrome.runtime.lastError.message);
                            } else {
                              var group = windowInfo.groups[groupId];
                              chrome.tabGroups.update(newGroupId, { title: group.title, color: group.color }, function() {
                                resolve();
                              });
                            }
                          });
                        })
                      );
                    }
                  }
                }

                return Promise.all(groupPromises);
              })
              .then(() => {
                console.log("Tabs and groups opened successfully");
              })
              .catch(error => {
                console.error("Error opening tabs and groups:", error);
              });
          });
        }
      }
    }
  });
}

function openAllTabs() {
  chrome.storage.local.get(['savedTabs'], function(result) {
    if (result.savedTabs) {
      result.savedTabs.forEach(function(window) {
        openWindow(window.windowId);
      });
    }
  });
}

function deleteAllTabs() {
  chrome.storage.local.remove('savedTabs', function() {
    loadTabs(); // Reload tabs after deleting all
  });
}

function exportTabs() {
  chrome.storage.local.get(['savedTabs'], function(result) {
    if (result.savedTabs) {
      var dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(result.savedTabs));
      var downloadAnchorNode = document.createElement('a');
      downloadAnchorNode.setAttribute("href", dataStr);
      downloadAnchorNode.setAttribute("download", "saved_tabs.json");
      document.body.appendChild(downloadAnchorNode); // Required for Firefox
      downloadAnchorNode.click();
      downloadAnchorNode.remove();
    }
  });
}

function importTabs() {
  var fileInput = document.createElement('input');
  fileInput.type = 'file';
  fileInput.accept = '.json';

  fileInput.onchange = function(event) {
    var file = event.target.files[0];
    var reader = new FileReader();
    reader.onload = function(e) {
      try {
        var importedTabs = JSON.parse(e.target.result);
        chrome.storage.local.set({ savedTabs: importedTabs }, function() {
          loadTabs(); // Reload tabs after importing
        });
      } catch (error) {
        console.error('Error importing tabs:', error);
      }
    };
    reader.readAsText(file);
  };

  fileInput.click();
}

// function importTabs() {
//   var fileInput = document.getElementById('importTabs');
//   var file = fileInput.files[0];
//   var reader = new FileReader();

//   reader.onload = function(event) {
//     try {
//       var importedTabs = JSON.parse(event.target.result);
//       chrome.storage.local.set({ savedTabs: importedTabs }, function() {
//         loadTabs(); // Reload tabs after importing
//         document.getElementById('status').textContent = "Tabs imported successfully!";
//       });
//     } catch (error) {
//       console.error("Error importing tabs:", error);
//       document.getElementById('status').textContent = "Error importing tabs: " + error.message;
//     }
//   };

//   if (file) {
//     reader.readAsText(file);
//   } else {
//     document.getElementById('status').textContent = "No file selected!";
//   }
// }