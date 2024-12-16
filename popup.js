document.addEventListener('DOMContentLoaded', function() { 
  // Button event listeners
  document.getElementById('saveTabs').addEventListener('click', saveTabs);
  document.getElementById('toggleAllTabs').addEventListener('click', toggleAllTrees);
  document.getElementById('reloadTabsInActiveWindow').addEventListener('click', reloadTabsInActiveWindow); 
  document.getElementById('reloadAllTabs').addEventListener('click', reloadAllTabs); 

  // Menu button handling
  const menuButton = document.getElementById('menuButton');
  const menuDropdown = document.getElementById('menuDropdown');
  
  menuButton.addEventListener('click', function(e) {
    e.stopPropagation();
    menuDropdown.classList.toggle('show');
  });

// Close menu when clicking anywhere else
document.addEventListener('click', function(e) {
  if (menuDropdown.classList.contains('show')) {
    if (!menuDropdown.contains(e.target) && !menuButton.contains(e.target)) {
      menuDropdown.classList.remove('show');
    }
  }
});

// Close menu when mouse leaves dropdown area
menuDropdown.addEventListener('mouseleave', function() {
  menuDropdown.classList.remove('show');
});

// Close menu after clicking a menu item
document.querySelectorAll('.menu-dropdown .menu-item').forEach(item => {
  item.addEventListener('click', function() {
    menuDropdown.classList.remove('show');
  });
});





  // Menu item event listeners
  document.getElementById('exportTabs').addEventListener('click', exportTabs);
  document.getElementById('deleteAllTabs').addEventListener('click', function() {
    if (confirm('Are you sure you want to delete all saved tabs?')) {
      deleteAllTabs();
    }
  });

  // Import handling
  const importInput = document.getElementById('importTabsInput');
  document.getElementById('importTabs').addEventListener('click', function() {
    importInput.click();
  });

  importInput.addEventListener('change', function(event) {
    const file = event.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = function(e) {
        try {
          const importedTabs = JSON.parse(e.target.result);
          chrome.storage.local.set({ savedTabs: importedTabs }, function() {
            loadTabs();
            document.getElementById('status').textContent = "Tabs imported successfully!";
          });
        } catch (error) {
          console.error("Error importing tabs:", error);
          document.getElementById('status').textContent = "Error importing tabs: " + error.message;
        }
      };
      reader.readAsText(file);
    }
  });

  // Close menu when clicking outside
  document.addEventListener('click', function(e) {
    if (!menuDropdown.contains(e.target) && !menuButton.contains(e.target)) {
      menuDropdown.classList.remove('show');
    }
  });

  // Search functionality
  document.getElementById('searchTabs').addEventListener('input', debounce(function(e) {
    const searchTerm = e.target.value.toLowerCase();
    filterTabs(searchTerm);
  }, 300));

  // Initialize tabs
  loadTabs();
});


// Add debounce function to prevent too many rapid calls
function debounce(func, wait) {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}

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

function truncateText(text, maxLength) {
  if (text.length <= maxLength) return text;
  return text.substr(0, maxLength - 3) + '...';
}

function saveWindowName(windowId, newName) {
  chrome.storage.local.get(['windowNames'], function(result) {
    const windowNames = result.windowNames || {};
    windowNames[windowId] = newName;
    chrome.storage.local.set({ windowNames: windowNames }, function() {
      console.log('Window name saved');
    });
  });
}

function getWindowName(windowId, callback) {
  chrome.storage.local.get(['windowNames'], function(result) {
    const windowNames = result.windowNames || {};
    const name = windowNames[windowId] || `Window ${windowId}`;
    callback(name);
  });
}

function loadTabs() {
  chrome.storage.local.get(['savedTabs'], function(result) {
    console.log('Loading saved tabs:', result.savedTabs);
    if (result.savedTabs && result.savedTabs[0] && result.savedTabs[0].tabs) {
        console.log('Sample tab data:');
        console.log('First tab:', result.savedTabs[0].tabs[0]);
        if (result.savedTabs[0].tabs[0]) {
            console.log('Favicon URL:', result.savedTabs[0].tabs[0].favIconUrl);
        }
    }

    // Add detailed logging for one window
    if (result.savedTabs && result.savedTabs[0]) {
      console.log('First window tabs:');
      result.savedTabs[0].tabs.forEach(tab => {
          console.log({
              title: tab.title,
              favIconUrl: tab.favIconUrl,
              url: tab.url
          });
      });
    }


    const windowsList = document.getElementById('windowsList');
    windowsList.innerHTML = ''; // Clear existing list

    if (result.savedTabs) {
      // Create the root unordered list
      const rootList = document.createElement('ul');
      rootList.className = 'tree-root';

      result.savedTabs.forEach(function(window) {
        // Create window list item
        const windowLi = document.createElement('li');
        windowLi.className = 'tree-window';

        // Create window header with expand/collapse arrow
        const windowHeader = document.createElement('div');
        windowHeader.className = 'tree-header';
        
        // For window toggle
        const toggleSpan = document.createElement('span');
        toggleSpan.className = 'tree-toggle material-icons';
        toggleSpan.textContent = 'expand_more'; // Instead of '▼'
        toggleSpan.addEventListener('click', function(e) {
          e.stopPropagation();
          const isExpanded = this.textContent === 'expand_more';
          this.textContent = isExpanded ? 'navigate_next' : 'expand_more';
          const content = this.parentElement.nextElementSibling;
          content.style.display = isExpanded ? 'none' : 'block';
        });


        // Modify the window title creation in your loadTabs function
        // Replace the existing window title creation code with this:

        const windowTitle = document.createElement('span');
        windowTitle.className = 'tree-title';
        const titleText = document.createTextNode('');
        windowTitle.appendChild(titleText);
        getWindowName(window.windowId, function(name) {
          windowTitle.textContent = name;

          // Add edit icon here
          const editIcon = document.createElement('span');
          editIcon.className = 'material-icons edit-icon';
          editIcon.textContent = 'edit';
          editIcon.style.fontSize = '14px';
          editIcon.style.marginLeft = '4px';
          editIcon.style.opacity = '0';
          windowTitle.appendChild(editIcon);
        });

        // Add double-click handler for editing
        windowTitle.addEventListener('dblclick', function(e) {
          e.stopPropagation();
          const windowName = windowTitle.firstChild.textContent;  
          const input = document.createElement('input');
          input.type = 'text';
          input.value = windowName;
          input.className = 'tree-title-input';
          
          // Replace span with input
          this.replaceWith(input);
          input.focus();
          input.select();

          // Handle saving on enter or blur
          function saveAndRevert() {
            const newName = input.value.trim() || windowName;
            windowTitle.firstChild.textContent = newName;  // Update just the text node
            input.replaceWith(windowTitle);
            saveWindowName(window.windowId, newName);
        }

          input.addEventListener('keydown', function(e) {
            if (e.key === 'Enter') {
                e.preventDefault();
                saveAndRevert();
            } else if (e.key === 'Escape') {
                windowTitle.firstChild.textContent = windowName;  // Revert just the text node
                input.replaceWith(windowTitle);
            }
        });

          input.addEventListener('blur', saveAndRevert);
        });


        
        // Add window controls
        const controls = document.createElement('span');
        controls.className = 'tree-controls';
        
        const openBtn = document.createElement('button');
        openBtn.className = 'tree-btn';
        openBtn.innerHTML = '<i class="material-icons">open_in_new</i>';
        openBtn.title = 'Open Window';
        openBtn.addEventListener('click', function(e) {
          e.stopPropagation();
          openWindow(window.windowId);
        });



        //
        // DO I NEED THIS DeleteBtn?  Which is this for?
        // ??
        // ??
        const deleteBtn = document.createElement('button');
        deleteBtn.className = 'tree-btn';
        deleteBtn.innerHTML = '<i class="material-icons">delete</i>';
        deleteBtn.title = 'Delete Window';
        deleteBtn.addEventListener('click', function(e) {
          e.stopPropagation();
          deleteWindow(window.windowId);
        });

        controls.appendChild(openBtn);
        controls.appendChild(deleteBtn);

        windowHeader.appendChild(toggleSpan);
        windowHeader.appendChild(windowTitle);
        windowHeader.appendChild(controls);
        windowLi.appendChild(windowHeader);

        // Create container for window content
        const windowContent = document.createElement('div');
        windowContent.className = 'tree-content';
        windowContent.style.display = 'block'; 

        // If there are ungrouped tabs, create a "Tabs" section
        // For ungrouped tabs
        if (window.tabs && window.tabs.length > 0) {
          const tabsList = document.createElement('ul');
          window.tabs.forEach(function(tab) {
            const tabLi = document.createElement('li');
            tabLi.className = 'tree-tab';

            // Create tab item with favicon
            const tabContent = document.createElement('div');
            tabContent.className = 'tree-tab-content';

            // Add favicon
            if (tab.favIconUrl) {
              const favicon = document.createElement('img');
              favicon.src = tab.favIconUrl;
              favicon.className = 'tree-favicon';
              favicon.onerror = function() {
                console.log('Favicon failed to load:', tab.favIconUrl, 'for tab:', tab.title);
                const defaultIcon = document.createElement('span');
                defaultIcon.className = 'material-icons tree-favicon';
                defaultIcon.textContent = 'public';
                favicon.replaceWith(defaultIcon);
              };
              tabContent.appendChild(favicon);
            } else {
              const defaultIcon = document.createElement('span');
              defaultIcon.className = 'material-icons tree-favicon';
              defaultIcon.textContent = 'public';
              tabContent.appendChild(defaultIcon);
            }

            const tabLink = document.createElement('a');
            tabLink.href = tab.url;
            tabLink.textContent = truncateText(tab.title || tab.url, 50);
            tabLink.title = tab.title || tab.url;
            // Add click handler
            tabLink.addEventListener('click', function(e) {
              e.preventDefault();
              const url = this.href;
              
              // Search for existing tab with this URL
              chrome.tabs.query({}, function(tabs) {
                const existingTab = tabs.find(t => t.url === url);
                if (existingTab) {
                  // Focus the window containing the tab
                  chrome.windows.update(existingTab.windowId, { focused: true }, function() {
                    // Then activate the tab
                    chrome.tabs.update(existingTab.id, { active: true });
                  });
                } else {
                  // If tab doesn't exist, open in new tab
                  chrome.tabs.create({ url: url });
                }
              });
            });
            tabContent.appendChild(tabLink);

            const tabDelete = document.createElement('button');
            tabDelete.className = 'tree-btn';
            tabDelete.innerHTML = '<i class="material-icons">close</i>';
            tabDelete.addEventListener('click', function(e) {
              e.preventDefault();
              e.stopPropagation();
              deleteTab(tab.url);
            });
            tabContent.appendChild(tabDelete);

            tabLi.appendChild(tabContent);
            tabsList.appendChild(tabLi);
          });
          windowContent.appendChild(tabsList);
        }

        // Handle grouped tabs
        if (window.groups) {
          for (const groupId in window.groups) {
            if (window.groups.hasOwnProperty(groupId)) {
              const group = window.groups[groupId];
              const groupList = document.createElement('ul');
              
              // Create group header
              const groupLi = document.createElement('li');
              groupLi.className = 'tree-group';

              const groupHeader = document.createElement('div');
              groupHeader.className = 'tree-header';

              const groupToggle = document.createElement('span');
              groupToggle.className = 'tree-toggle material-icons';
              groupToggle.textContent = 'expand_more';
              groupToggle.addEventListener('click', function(e) {
                e.stopPropagation();
                const isExpanded = this.textContent === 'expand_more';
                this.textContent = isExpanded ? 'navigate_next' : 'expand_more';
                const content = this.parentElement.nextElementSibling;
                content.style.display = isExpanded ? 'none' : 'block';
              });

              const groupTitle = document.createElement('span');
              groupTitle.textContent = group.title;
              groupTitle.className = 'tree-title';

              groupHeader.appendChild(groupToggle);
              groupHeader.appendChild(groupTitle);
              groupLi.appendChild(groupHeader);

              // Create group content
              const groupContent = document.createElement('div');
              groupContent.className = 'tree-content';
              groupContent.style.display = 'block'; 
              
              // Add tabs to group
              const groupTabsList = document.createElement('ul');
              group.tabs.forEach(function(tab) {
                const tabLi = document.createElement('li');
                tabLi.className = 'tree-tab';

                const tabContent = document.createElement('div');
                tabContent.className = 'tree-tab-content';

                if (tab.favIconUrl) {
                  const favicon = document.createElement('img');
                  favicon.src = tab.favIconUrl;
                  favicon.className = 'tree-favicon';
                  favicon.onerror = function() {
                      console.log('Favicon failed to load:', tab.favIconUrl, 'for tab:', tab.title);
                      const defaultIcon = document.createElement('span');
                      defaultIcon.className = 'material-icons tree-favicon';
                      defaultIcon.textContent = 'public';
                      favicon.replaceWith(defaultIcon);
                  };
                  tabContent.appendChild(favicon);
                }

                const tabLink = document.createElement('a');
                tabLink.href = tab.url;
                tabLink.textContent = truncateText(tab.title || tab.url, 50);
                tabLink.title = tab.title || tab.url;
                tabLink.addEventListener('click', function(e) {
                  e.preventDefault();
                  const url = this.href;
                  chrome.tabs.query({}, function(tabs) {
                    const existingTab = tabs.find(t => t.url === url);
                    if (existingTab) {
                      chrome.windows.update(existingTab.windowId, { focused: true }, function() {
                        chrome.tabs.update(existingTab.id, { active: true });
                      });
                    } else {
                      chrome.tabs.create({ url: url });
                    }
                  });
                });
                tabContent.appendChild(tabLink);

                const tabDelete = document.createElement('button');
                tabDelete.className = 'tree-btn';
                tabDelete.innerHTML = '<i class="material-icons">close</i>';
                tabDelete.addEventListener('click', function(e) {
                  e.preventDefault();
                  e.stopPropagation();
                  deleteTab(tab.url);
                });
                tabContent.appendChild(tabDelete);

                tabLi.appendChild(tabContent);
                groupTabsList.appendChild(tabLi);
              });

              groupContent.appendChild(groupTabsList);
              groupLi.appendChild(groupContent);
              windowContent.appendChild(groupLi);
            }
          }
        }

        windowLi.appendChild(windowContent);
        rootList.appendChild(windowLi);
      });

      windowsList.appendChild(rootList);
    }
  });
}
// In the loadTabs function where we create tab items
function createTabListItem(tab, windowId, groupId, tabIndex) {
  const li = document.createElement('li');
  li.className = 'tree-tab';

  const tabContent = document.createElement('div');
  tabContent.className = 'tree-tab-content';

  // Try to get favicon URL
  const faviconUrl = getFaviconUrl(tab);
  console.log('Favicon URL for tab:', tab.title, 'is:', faviconUrl);
  
  // Add favicon
  if (tab.favIconUrl) {
    console.log('Creating favicon for:', tab.title, 'URL:', tab.favIconUrl);
    const favicon = document.createElement('img');
    favicon.src = tab.favIconUrl;
    favicon.className = 'tree-favicon';
    favicon.onerror = function() {
      // Replace with default icon if favicon fails to load
      console.log('Favicon failed to load for:', tab.title);
      const defaultIcon = document.createElement('span');
      defaultIcon.className = 'material-icons tree-favicon';
      defaultIcon.textContent = 'public';
      favicon.replaceWith(defaultIcon);
    };
    tabContent.appendChild(favicon);
  } else {
    // Add default icon if no favicon
    console.log('No favicon URL for:', tab.title);
    const defaultIcon = document.createElement('span');
    defaultIcon.className = 'material-icons tree-favicon';
    defaultIcon.textContent = 'public';
    tabContent.appendChild(defaultIcon);
  }

  // Add link
  const a = document.createElement('a');
  a.href = tab.url;
  a.textContent = tab.title || tab.url;
  a.target = '_blank';
  tabContent.appendChild(a);

  // Add delete button
  const deleteBtn = document.createElement('button');
  deleteBtn.className = 'deleteBtn tree-btn';
  deleteBtn.innerHTML = '<i class="material-icons">close</i>';
  deleteBtn.addEventListener('click', function() {
    if (groupId !== undefined && tabIndex !== undefined) {
      deleteGroupTab(windowId, groupId, tabIndex);
    } else {
      deleteTab(tab.url);
    }
  });
  tabContent.appendChild(deleteBtn);

  li.appendChild(tabContent);
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
  console.log('Starting deleteAllTabs function'); // Debug line
  chrome.storage.local.get(['savedTabs'], function(result) {
      console.log('Current savedTabs:', result.savedTabs); // Debug line
      chrome.storage.local.remove('savedTabs', function() {
          console.log('Tabs deleted from storage'); // Debug line
          loadTabs();
          document.getElementById('status').textContent = "All tabs deleted!";
      });
  });
}

function deleteAllTabs1() {
  console.log('Deleting all tabs'); // Debug line
  chrome.storage.local.remove('savedTabs', function() {
    console.log('Tabs deleted'); // Debug line
    loadTabs(); // Reload tabs after deleting all
    document.getElementById('status').textContent = "All tabs deleted!";
  });
}

function exportTabs() {
  chrome.storage.local.get(['savedTabs'], function(result) {
    if (result.savedTabs) {
      // Create timestamp in format YYYY-MM-DD_HHMM
      const now = new Date();
      const date = now.toISOString().split('T')[0]; // Gets YYYY-MM-DD
      const time = now.getHours().toString().padStart(2, '0') + 
                  now.getMinutes().toString().padStart(2, '0');
      const filename = `TabSaver_${date}_${time}.json`;

      var dataStr = "data:text/json;charset=utf-8," + 
                    encodeURIComponent(JSON.stringify(result.savedTabs));
      var downloadAnchorNode = document.createElement('a');
      downloadAnchorNode.setAttribute("href", dataStr);
      downloadAnchorNode.setAttribute("download", filename);
      document.body.appendChild(downloadAnchorNode);
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

function toggleAllTrees() {
  const toggleIcon = document.getElementById('toggleIcon');
  const isCollapsing = toggleIcon.textContent === 'unfold_less';
  
  // Update icon and tooltip
  toggleIcon.textContent = isCollapsing ? 'unfold_more' : 'unfold_less';
  toggleIcon.parentElement.querySelector('.tooltip').textContent = 
      isCollapsing ? 'Expand All' : 'Collapse All';

  // Get all content sections and toggle buttons
  const allContents = document.querySelectorAll('.tree-content');
  const allToggles = document.querySelectorAll('.tree-toggle');

  allContents.forEach(content => {
      content.style.display = isCollapsing ? 'none' : 'block';
  });

  allToggles.forEach(toggle => {
    toggle.textContent = isCollapsing ? 'navigate_next' : 'expand_more';
  });
}

// Simplified filterTabs function
function filterTabs(searchTerm) {
  const allTabItems = document.querySelectorAll('.tree-tab');
  const allWindows = document.querySelectorAll('.tree-window');
  
  // If search is empty, show everything
  if (!searchTerm) {
    allTabItems.forEach(item => item.style.display = 'block');
    allWindows.forEach(window => window.style.display = 'block');
    document.querySelectorAll('.tree-content').forEach(content => 
      content.style.display = 'block'
    );
    return;
  }

  // Hide all windows initially
  allWindows.forEach(window => window.style.display = 'none');

  // Check each tab
  allTabItems.forEach(tabItem => {
    const tabLink = tabItem.querySelector('a');
    if (!tabLink) return;

    const title = (tabLink.textContent || '').toLowerCase();
    const url = (tabLink.href || '').toLowerCase();
    
    if (title.includes(searchTerm) || url.includes(searchTerm)) {
      // Show matching tab
      tabItem.style.display = 'block';
      
      // Show parent window
      const parentWindow = tabItem.closest('.tree-window');
      if (parentWindow) {
        parentWindow.style.display = 'block';
      }
      
      // Show parent content
      const parentContent = tabItem.closest('.tree-content');
      if (parentContent) {
        parentContent.style.display = 'block';
      }
    } else {
      tabItem.style.display = 'none';
    }
  });
}
function getFaviconUrl(url) {
  // Try multiple favicon sources
  const sources = [
      tab => tab.favIconUrl,
      tab => `chrome://favicon/${tab.url}`,
      tab => {
          try {
              const urlObj = new URL(tab.url);
              return `https://www.google.com/s2/favicons?domain=${urlObj.hostname}`;
          } catch (e) {
              return null;
          }
      }
  ];

  for (const source of sources) {
      const faviconUrl = source({ url });
      if (faviconUrl) return faviconUrl;
  }
  return null;
}

function reloadAllTabs() {
  chrome.windows.getAll({ populate: true }, (windows) => {
    windows.forEach((window) => {
      window.tabs.forEach((tab) => {
        chrome.tabs.reload(tab.id);
      });
    });
  });
}

function reloadTabsInActiveWindow() {
  chrome.windows.getCurrent({}, (currentWindow) => {
    chrome.tabs.query({ windowId: currentWindow.id }, (tabs) => {
      tabs.forEach((tab) => {
        chrome.tabs.reload(tab.id);
      });
    });
  });
}
