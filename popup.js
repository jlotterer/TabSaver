document.addEventListener('DOMContentLoaded', function() {
  document.getElementById('saveTabs').addEventListener('click', saveTabs);
  document.getElementById('openTabs').addEventListener('click', openAllTabs);
  document.getElementById('deleteAllTabs').addEventListener('click', deleteAllTabs);
  document.getElementById('exportTabs').addEventListener('click', exportTabs); // Event listener for export button
  document.getElementById('importTabs').addEventListener('change', importTabs); // Event listener for import file input change
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
            group.tabs.forEach(function(tab) {
              var li = createTabListItem(tab);
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

function createTabListItem(tab) {
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
    deleteTab(tab.url);
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
        } else {
          // Check in groups if tab is not found in regular tabs
          for (var groupId in window.groups) {
            if (window.groups.hasOwnProperty(groupId)) {
              var group = window.groups[groupId];
              var groupTabIndex = group.tabs.findIndex(tab => tab.url === tabUrl);
              if (groupTabIndex !== -1) {
                group.tabs.splice(groupTabIndex, 1);
                if (group.tabs.length === 0) {
                  delete result.savedTabs[windowIndex].groups[groupId];
                }
                chrome.storage.local.set({ savedTabs: result.savedTabs }, function() {
                  loadTabs(); // Reload tabs after deleting
                });
                return;
              }
            }
          }
        }
      });
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
      var window = result.savedTabs.find(window => window.windowId === windowId);
      if (window) {
        var allTabs = [];

        // Collect all tabs from the window
        if (window.tabs && window.tabs.length > 0) {
          allTabs = allTabs.concat(window.tabs);
        }

        // Collect all tabs from each group
        for (var groupId in window.groups) {
          if (window.groups.hasOwnProperty(groupId)) {
            var group = window.groups[groupId];
            if (group.tabs && group.tabs.length > 0) {
              allTabs = allTabs.concat(group.tabs);
            }
          }
        }

        // Extract URLs from allTabs array
        var urls = allTabs.map(tab => tab.url);

        // Open a new Chrome window with all tabs and tab groups
        if (urls.length > 0) {
          chrome.windows.create({ url: urls });
        }
      }
    }
  });
}

function openAllTabs() {
  chrome.storage.local.get(['savedTabs'], function(result) {
    if (result.savedTabs) {
      result.savedTabs.forEach(function(window) {
        var allTabs = [];

        // Collect all tabs from the window and its groups
        if (window.tabs && window.tabs.length > 0) {
          allTabs = allTabs.concat(window.tabs);
        }

        for (var groupId in window.groups) {
          if (window.groups.hasOwnProperty(groupId)) {
            var group = window.groups[groupId];
            if (group.tabs && group.tabs.length > 0) {
              allTabs = allTabs.concat(group.tabs);
            }
          }
        }

        // Extract URLs from allTabs array
        var urls = allTabs.map(tab => tab.url);

        // Open a new Chrome window with all tabs for this window ID
        if (urls.length > 0) {
          chrome.windows.create({ url: urls });
        }
      });
    }
  });
}

function deleteAllTabs() {
  chrome.storage.local.remove('savedTabs', function() {
    loadTabs(); // Reload tabs after deleting all
    document.getElementById('status').textContent = "All saved tabs deleted!";
  });
}

function exportTabs() {
  chrome.storage.local.get(['savedTabs'], function(result) {
    if (result.savedTabs) {
      var data = JSON.stringify(result.savedTabs, null, 2);
      var blob = new Blob([data], { type: 'text/plain' });
      var url = URL.createObjectURL(blob);

      var a = document.createElement('a');
      a.href = url;
      a.download = 'saved_tabs.json';
      a.textContent = 'Download saved tabs';
      a.style.display = 'none';
      document.body.appendChild(a);

      a.click();

      setTimeout(function() {
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);
      }, 0);
    }
  });
}

function importTabs(event) {
  var fileInput = event.target;
  var file = fileInput.files[0];
  var reader = new FileReader();
  
  reader.onload = function(event) {
    try {
      var importedTabs = JSON.parse(event.target.result);
      chrome.storage.local.set({ savedTabs: importedTabs }, function() {
        loadTabs(); // Reload tabs after importing
        document.getElementById('status').textContent = "Tabs imported successfully!";
      });
    } catch (error) {
      console.error("Error importing tabs:", error);
      document.getElementById('status').textContent = "Error importing tabs: " + error.message;
    }
  };

  if (file) {
    reader.readAsText(file);
  } else {
    document.getElementById('status').textContent = "No file selected!";
  }
}
