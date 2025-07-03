document.addEventListener('DOMContentLoaded', function() { 
  // Button event listeners
  document.getElementById('saveTabs').addEventListener('click', saveTabs);
  document.getElementById('toggleAllTabs').addEventListener('click', toggleAllTrees);
  document.getElementById('reloadTabsInActiveWindow').addEventListener('click', reloadTabsInActiveWindow); 
  document.getElementById('reloadAllTabs').addEventListener('click', reloadAllTabs); 
  document.getElementById('sortWindows').addEventListener('click', sortWindows);
  document.getElementById('archiveSession').addEventListener('click', archiveCurrentSession);
  document.getElementById('viewArchives').addEventListener('click', showArchivedSessions);
  document.getElementById('openSettings').addEventListener('click', function() {
    chrome.runtime.openOptionsPage();
  });

  
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

  // Update pause indicators
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    console.log('Received message:', message);
    
    if (message.action === "tabStateChanged") {
      // Update UI for the specific tab
      document.querySelectorAll('.tree-tab').forEach(element => {
        const link = element.querySelector('a');
        if (link && link.href === message.url) {
          console.log('Updating UI for tab:', message.url);
          const content = element.querySelector('.tree-tab-content');
          const indicator = element.querySelector('.pause-indicator');
          if (content) {
            content.classList.toggle('paused', message.discarded);
          }
          if (indicator) {
            indicator.style.opacity = message.discarded ? '1' : '0';
          }
        }
      });
    }
  });

  // Initialize tabs
  loadTabs();
  setTimeout(updateTabStates, 100); // Small delay to ensure DOM is ready
});



/////////////////////////////////////////////////////////////
// Core Utility Functions
/////////////////////////////////////////////////////////////

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

function truncateText(text, maxLength) {
  if (text.length <= maxLength) return text;
  return text.substr(0, maxLength - 3) + '...';
}

function getSafeFaviconUrl(tab) {
  // If the tab already has a valid favicon that's not a chrome://favicon URL, use it
  if (tab.favIconUrl && !tab.favIconUrl.startsWith('chrome://favicon/')) {
    return tab.favIconUrl;
  }
  
  try {
    const url = new URL(tab.url);
    const protocol = url.protocol;
    
    // Skip favicon generation for browser internal pages
    if (protocol === 'chrome:' || 
        protocol === 'edge:' || 
        protocol === 'moz-extension:' || 
        protocol === 'chrome-extension:' ||
        protocol === 'about:' ||
        protocol === 'data:') {
      return null; // Will use default icon
    }
    
    // For regular web pages, try Google's favicon service as backup
    if (protocol === 'http:' || protocol === 'https:') {
      return tab.favIconUrl || `https://www.google.com/s2/favicons?domain=${url.hostname}&sz=16`;
    }
    
    return null;
    
  } catch (e) {
    return null;
  }
}



/////////////////////////////////////////////////////////////
// Main Tab Management Functions
/////////////////////////////////////////////////////////////

function loadTabs() {
  const searchContainer = document.querySelector('.search-container');
  searchContainer.style.display = 'block'; // Always show search in main view

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
        toggleSpan.className = 'tree-toggle icon icon-expand';
        //toggleSpan.className = 'tree-toggle material-icons';
        //toggleSpan.textContent = 'expand_more'; // Instead of '▼'
        toggleSpan.addEventListener('click', function(e) {
          e.stopPropagation();
          const isExpanded = this.classList.contains('icon-expand');
          this.className = `tree-toggle icon ${isExpanded ? 'icon-collapse' : 'icon-expand'}`;
          const content = this.parentElement.nextElementSibling;
          content.style.display = isExpanded ? 'none' : 'block';
        });


        // Window title creation
        const windowTitle = document.createElement('span');
        windowTitle.className = 'tree-title';
        const titleText = document.createTextNode('');
        windowTitle.appendChild(titleText);
        getWindowName(window.windowId, function(name) {
          windowTitle.textContent = name;

          // Add edit icon 
          const editIcon = document.createElement('span');
          editIcon.className = 'icon icon-edit edit-icon';
          editIcon.style.fontSize = '30px';
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
        openBtn.innerHTML = '<span class="icon icon-open"></span>';
        openBtn.title = 'Open Window';
        openBtn.addEventListener('click', function(e) {
          e.stopPropagation();
          openWindow(window.windowId);
        });

        // Add archive button
        const archiveBtn = document.createElement('button');
        archiveBtn.className = 'tree-btn';
        archiveBtn.innerHTML = '<span class="icon icon-archive"></span>';
        archiveBtn.title = 'Archive Window';
        archiveBtn.addEventListener('click', function(e) {
          e.stopPropagation();
          const currentWindowId = window.windowId; // Store windowId in closure
          archiveWindow(currentWindowId); // Use stored windowId
        });

        // Add pause button
        const pauseBtn = document.createElement('button');
        pauseBtn.className = 'tree-btn';
        pauseBtn.innerHTML = '<span class="icon icon-pause"></span>';
        pauseBtn.title = 'Pause All Tabs';
        pauseBtn.addEventListener('click', function(e) {
          e.stopPropagation();
          pauseTabsInWindow(window.windowId);
        });


        // DeleteBtn allows users to delete saved windows from their saved 
        // tabs list without having to open them first. It's different 
        // from archiving - this permanently removes the window data.
        const deleteBtn = document.createElement('button');
        deleteBtn.className = 'tree-btn';
        deleteBtn.innerHTML = '<span class="icon icon-delete"></span>';
        deleteBtn.title = 'Delete Window';
        deleteBtn.addEventListener('click', function(e) {
          e.stopPropagation();
          deleteWindow(window.windowId);
        });

        controls.appendChild(openBtn);
        controls.appendChild(archiveBtn);
        controls.appendChild(pauseBtn);
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

            // Add a pause indicator
            const pauseIndicator = document.createElement('span');
            pauseIndicator.className = 'icon icon-pause-indicator pause-indicator';
            pauseIndicator.style.opacity = tab.discarded ? '1' : '0';
            tabContent.appendChild(pauseIndicator);

            // Add favicon
            if (tab.favIconUrl) {
              const favicon = document.createElement('img');
              favicon.src = tab.favIconUrl;
              favicon.className = 'tree-favicon';
              favicon.onerror = function() {
                console.log('Favicon failed to load:', tab.favIconUrl, 'for tab:', tab.title);
                // Try Google's favicon service as fallback
                const safeUrl = getSafeFaviconUrl(tab);
                if (safeUrl && safeUrl !== tab.favIconUrl) {
                  this.src = safeUrl;
                  this.onerror = function() {
                    // Final fallback to default icon
                    const defaultIcon = document.createElement('span');
                    defaultIcon.className = 'icon icon-public tree-favicon';
                    this.replaceWith(defaultIcon);
                  };
                } else {
                  // Use default icon
                  const defaultIcon = document.createElement('span');
                  defaultIcon.className = 'icon icon-public tree-favicon';
                  this.replaceWith(defaultIcon);
                }
              };
              tabContent.appendChild(favicon);
            } else {
              const defaultIcon = document.createElement('span');
              defaultIcon.className = 'icon icon-public tree-favicon';
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
            tabDelete.innerHTML = '<span class="icon icon-close"></span>';
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
              groupToggle.className = 'tree-toggle icon icon-expand';
              groupToggle.addEventListener('click', function(e) {
                e.stopPropagation();
                const isExpanded = this.classList.contains('icon-expand');
                this.className = `tree-toggle icon ${isExpanded ? 'icon-collapse' : 'icon-expand'}`;
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

                // Add a pause indicator
                const pauseIndicator = document.createElement('span');
                pauseIndicator.className = 'icon icon-pause-indicator pause-indicator';
                pauseIndicator.style.opacity = tab.discarded ? '1' : '0';
                tabContent.appendChild(pauseIndicator);

                // Add favicon
                if (tab.favIconUrl) {
                  const favicon = document.createElement('img');
                  favicon.src = tab.favIconUrl;
                  favicon.className = 'tree-favicon';
                  favicon.onerror = function() {
                    console.log('Favicon failed to load:', tab.favIconUrl, 'for tab:', tab.title);
                    // Try Google's favicon service as fallback
                    const safeUrl = getSafeFaviconUrl(tab);
                    if (safeUrl && safeUrl !== tab.favIconUrl) {
                      this.src = safeUrl;
                      this.onerror = function() {
                        // Final fallback to default icon
                        const defaultIcon = document.createElement('span');
                        defaultIcon.className = 'icon icon-public tree-favicon';
                        this.replaceWith(defaultIcon);
                      };
                    } else {
                      // Use default icon
                      const defaultIcon = document.createElement('span');
                      defaultIcon.className = 'icon icon-public tree-favicon';
                      this.replaceWith(defaultIcon);
                    }
                  };
                  tabContent.appendChild(favicon);
                } else {
                  const defaultIcon = document.createElement('span');
                  defaultIcon.className = 'icon icon-public tree-favicon';
                  tabContent.appendChild(defaultIcon);
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
                tabDelete.innerHTML = '<span class="icon icon-close"></span>';
                tabDelete.addEventListener('click', function(e) {
                  e.preventDefault();
                  e.stopPropagation();
                  deleteGroupTab(window.windowId, groupId, tab.url);  // Pass URL instead of index
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
  updateTabStates();
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

function updateTabStates() {
  chrome.tabs.query({}, function(tabs) {
    tabs.forEach(tab => {
      document.querySelectorAll('.tree-tab').forEach(element => {
        const link = element.querySelector('a');
        if (link && link.href === tab.url) {
          const content = element.querySelector('.tree-tab-content');
          const indicator = element.querySelector('.pause-indicator');
          if (content) content.classList.toggle('paused', tab.discarded);
          if (indicator) indicator.classList.toggle('active', tab.discarded);
        }
      });
    });
  });
}



/////////////////////////////////////////////////////////////
// Window Management Functions
/////////////////////////////////////////////////////////////

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

function openWindow(windowId) {
  chrome.storage.local.get(['savedTabs'], function(result) {
    if (result.savedTabs) {
      var windowInfo = result.savedTabs.find(window => window.windowId === windowId);
      if (windowInfo) {
        var tabsToCreate = [];

        // Collect all tab URLs and maintain their original group information
        windowInfo.tabs.forEach(tab => {
          tabsToCreate.push({ 
            url: tab.url, 
            groupId: null,
            originalGroupTitle: null,
            originalGroupColor: null
          });
        });

        // Add group information for grouped tabs
        Object.entries(windowInfo.groups).forEach(([groupId, group]) => {
          group.tabs.forEach(tab => {
            tabsToCreate.push({ 
              url: tab.url, 
              groupId: groupId,
              originalGroupTitle: group.title,
              originalGroupColor: group.color
            });
          });
        });

        // Open new window with first tab
        if (tabsToCreate.length > 0) {
          chrome.windows.create({ url: tabsToCreate[0].url }, function(newWindow) {
            if (chrome.runtime.lastError) {
              console.error("Error creating window:", chrome.runtime.lastError.message);
              return;
            }

            const newWindowId = newWindow.id;
            const tabCreationPromises = [];
            const groupMapping = new Map(); // Map to track new group IDs

            // Create remaining tabs
            for (let i = 1; i < tabsToCreate.length; i++) {
              const tabToCreate = tabsToCreate[i];
              tabCreationPromises.push(
                new Promise((resolve, reject) => {
                  chrome.tabs.create({ 
                    windowId: newWindowId, 
                    url: tabToCreate.url, 
                    active: false 
                  }, function(newTab) {
                    if (chrome.runtime.lastError) {
                      reject(chrome.runtime.lastError.message);
                    } else {
                      resolve({
                        tabId: newTab.id,
                        groupId: tabToCreate.groupId,
                        groupTitle: tabToCreate.originalGroupTitle,
                        groupColor: tabToCreate.originalGroupColor
                      });
                    }
                  });
                })
              );
            }

            Promise.all(tabCreationPromises)
              .then(createdTabs => {
                // Group tabs by their original group IDs
                const tabsByOriginalGroup = new Map();
                
                createdTabs.forEach(tab => {
                  if (tab.groupId) {
                    if (!tabsByOriginalGroup.has(tab.groupId)) {
                      tabsByOriginalGroup.set(tab.groupId, {
                        tabIds: [],
                        title: tab.groupTitle,
                        color: tab.groupColor
                      });
                    }
                    tabsByOriginalGroup.get(tab.groupId).tabIds.push(tab.tabId);
                  }
                });

                // Create each group separately
                const groupCreationPromises = Array.from(tabsByOriginalGroup.entries()).map(([_, groupInfo]) => {
                  return new Promise((resolve, reject) => {
                    chrome.tabs.group({
                      tabIds: groupInfo.tabIds,
                      createProperties: { windowId: newWindowId }
                    }, (newGroupId) => {
                      if (chrome.runtime.lastError) {
                        reject(chrome.runtime.lastError.message);
                      } else {
                        // Update group properties
                        chrome.tabGroups.update(newGroupId, {
                          title: groupInfo.title,
                          color: groupInfo.color
                        }, () => resolve());
                      }
                    });
                  });
                });

                return Promise.all(groupCreationPromises);
              })
              .then(() => {
                console.log("Tabs and groups restored successfully");
              })
              .catch(error => {
                console.error("Error restoring tabs and groups:", error);
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

function sortWindows() {
  chrome.storage.local.get(['savedTabs', 'windowNames'], function(result) {    
    const windowNames = result.windowNames || {};
    
    // Sort the savedTabs array based on window names
    result.savedTabs.sort((a, b) => {
      const nameA = windowNames[a.windowId] || `Window ${a.windowId}`;
      const nameB = windowNames[b.windowId] || `Window ${b.windowId}`;
      return nameA.localeCompare(nameB);
    });
    
    // Save the sorted tabs back to storage
    chrome.storage.local.set({ savedTabs: result.savedTabs }, function() {
      loadTabs(); // Reload the UI with sorted windows
      document.getElementById('status').textContent = "Windows sorted alphabetically!";
      setTimeout(() => {
        document.getElementById('status').textContent = "";
      }, 2000);
    });
  });
}



/////////////////////////////////////////////////////////////
// Tab Actions Functions
/////////////////////////////////////////////////////////////

function deleteTab(tabUrl) {
  // First find the tab element in the DOM
  const tabElements = document.querySelectorAll('.tree-tab');
  let tabElementToDelete = null;
  
  for (let element of tabElements) {
    const linkElement = element.querySelector('a');
    if (linkElement && linkElement.href === tabUrl) {
      tabElementToDelete = element;
      break;
    }
  }

  // If we found the element, proceed with deletion
  if (tabElementToDelete) {
    chrome.storage.local.get(['savedTabs'], function(result) {
      if (result.savedTabs) {
        let windowToUpdate = null;
        let windowIndex = -1;
        let foundTab = false;

        // Find the window containing this tab
        result.savedTabs.forEach((window, index) => {
          // First try exact match
          let tabIndex = window.tabs.findIndex(tab => tab.url === tabUrl);
          
          // If not found, try normalized comparison
          if (tabIndex === -1) {
            tabIndex = window.tabs.findIndex(tab => {
              // Normalize URLs for comparison
              const normalizeUrl = (url) => {
                try {
                  const urlObj = new URL(url);
                  return urlObj.toString(); // This normalizes the URL format
                } catch {
                  return url; // Return original if invalid URL
                }
              };
              return normalizeUrl(tab.url) === normalizeUrl(tabUrl);
            });
          }

          if (tabIndex !== -1) {
            windowToUpdate = window;
            windowIndex = index;
            // Remove the tab from storage
            result.savedTabs[index].tabs.splice(tabIndex, 1);
            foundTab = true;
          }
        });

        if (foundTab && windowToUpdate) {
          const windowElement = tabElementToDelete.closest('.tree-window');
          
          // Remove the tab element from DOM
          tabElementToDelete.remove();

          // Check if window should be removed
          if (windowToUpdate.tabs.length === 0 && 
              (!windowToUpdate.groups || Object.keys(windowToUpdate.groups).length === 0)) {
            result.savedTabs.splice(windowIndex, 1);
            if (windowElement) {
              windowElement.remove();
            }
          }

          // Update storage
          chrome.storage.local.set({ savedTabs: result.savedTabs });
        }
      }
    });
  }
}

function deleteGroupTab(windowId, groupId, tabUrl) {
  chrome.storage.local.get(['savedTabs'], function(result) {
    if (result.savedTabs) {
      const windowIndex = result.savedTabs.findIndex(window => window.windowId === windowId);
      if (windowIndex !== -1) {
        const window = result.savedTabs[windowIndex];
        if (window.groups && window.groups[groupId]) {
          const group = window.groups[groupId];
          
          // Normalize URLs for comparison
          const normalizeUrl = (url) => {
            try {
              const urlObj = new URL(url);
              return urlObj.toString();
            } catch {
              return url;
            }
          };
          
          // Find tab index by URL in storage
          let tabIndex = group.tabs.findIndex(tab => tab.url === tabUrl);
          
          // If not found, try normalized comparison
          if (tabIndex === -1) {
            tabIndex = group.tabs.findIndex(tab => 
              normalizeUrl(tab.url) === normalizeUrl(tabUrl)
            );
          }
          
          if (tabIndex === -1) return;

          // Remove from storage
          group.tabs.splice(tabIndex, 1);

          // Find and remove from DOM
          const tabElements = document.querySelectorAll('.tree-tab');
          for (let element of tabElements) {
            const linkElement = element.querySelector('a');
            if (linkElement && (
                linkElement.href === tabUrl || 
                normalizeUrl(linkElement.href) === normalizeUrl(tabUrl)
            )) {
              const groupElement = element.closest('.tree-group');
              const windowElement = element.closest('.tree-window');
              
              // Remove the tab element
              element.remove();

              // If group is now empty
              if (group.tabs.length === 0) {
                delete window.groups[groupId];
                if (groupElement) {
                  groupElement.remove();
                }
              }

              // If window is now empty
              if (window.tabs.length === 0 && Object.keys(window.groups).length === 0) {
                result.savedTabs.splice(windowIndex, 1);
                if (windowElement) {
                  windowElement.remove();
                }
              }
              
              break;
            }
          }

          // Update storage
          chrome.storage.local.set({ savedTabs: result.savedTabs });
        }
      }
    }
  });
}

function deleteWindow(windowId) {
  chrome.storage.local.get(['savedTabs'], function(result) {
    if (result.savedTabs) {
      const windowIndex = result.savedTabs.findIndex(window => window.windowId === windowId);
      if (windowIndex !== -1) {
        // Find the window element in the DOM
        const windowElements = document.querySelectorAll('.tree-window');
        for (let element of windowElements) {
          const titleElement = element.querySelector('.tree-title');
          if (titleElement && titleElement.textContent.includes(`Window ${windowId}`)) {
            // Remove from DOM
            element.remove();
            break;
          }
        }

        // Remove from storage
        result.savedTabs.splice(windowIndex, 1);
        chrome.storage.local.set({ savedTabs: result.savedTabs });
      }
    }
  });
}

function deleteAllTabs() {
  console.log('Starting deleteAllTabs function'); // Debug line
  chrome.storage.local.get(['savedTabs', 'archivedSessions'], function(result) {
    const archivedSessions = result.archivedSessions || [];
      console.log('Current savedTabs:', result.savedTabs); // Debug line
      chrome.storage.local.remove(['savedTabs', 'archivedSessions'], function() {
          console.log('Tabs deleted from storage'); // Debug line
          loadTabs();
          document.getElementById('status').textContent = "All tabs deleted!";
      });
  });
}

function createTabListItem(tab, windowId, groupId, tabIndex) {
  const li = document.createElement('li');
  li.className = 'tree-tab';

  const tabContent = document.createElement('div');
  tabContent.className = 'tree-tab-content';

  // Try to get favicon URL
  const faviconUrl = getSafeFaviconUrl(tab);
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
      defaultIcon.className = 'icon icon-public tree-favicon';
      favicon.replaceWith(defaultIcon);
    };
    tabContent.appendChild(favicon);
  } else {
    // Add default icon if no favicon
    console.log('No favicon URL for:', tab.title);
    const defaultIcon = document.createElement('span');
    defaultIcon.className = 'icon icon-public tree-favicon';
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
  deleteBtn.innerHTML = '<span class="icon icon-close"></span>';
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

function updateTabStates() {
  chrome.windows.getAll({ populate: true }, function(windows) {
    const allTabs = new Map();
    windows.forEach(window => {
      window.tabs.forEach(tab => {
        allTabs.set(tab.url, tab.discarded);
      });
    });

    // Update UI for all tabs
    document.querySelectorAll('.tree-tab').forEach(element => {
      const link = element.querySelector('a');
      if (link && allTabs.has(link.href)) {
        const isPaused = allTabs.get(link.href);
        const content = element.querySelector('.tree-tab-content');
        const indicator = element.querySelector('.pause-indicator');
        if (content) content.classList.toggle('paused', isPaused);
        if (indicator) indicator.style.opacity = isPaused ? '1' : '0';
      }
    });
  });
}


/////////////////////////////////////////////////////////////
// Archive Management Functions
/////////////////////////////////////////////////////////////

// New function to archive current session
function archiveCurrentSession() {
  chrome.storage.local.get(['savedTabs', 'windowNames', 'archivedSessions'], function(result) {
    const archivedSessions = result.archivedSessions || [];
    const timestamp = new Date().toISOString();
    
    const archive = {
      id: Date.now(),
      timestamp: timestamp,
      name: `Session ${new Date().toLocaleDateString()}`,
      type: 'session',  // Add type to distinguish between window and session archives
      windows: result.savedTabs || [],
      windowNames: result.windowNames || {}
    };

    archivedSessions.push(archive);
    chrome.storage.local.set({ archivedSessions: archivedSessions }, function() {
      document.getElementById('status').textContent = "Session archived!";
      setTimeout(() => document.getElementById('status').textContent = "", 2000);
    });
  });
}

// Function to archive a specific window
function archiveWindow(windowId) {
  chrome.storage.local.get(['savedTabs', 'windowNames', 'archivedSessions'], function(result) {
    const savedTabs = result.savedTabs || [];
    const windowNames = result.windowNames || {};
    const archivedSessions = result.archivedSessions || [];
    const windowIndex = savedTabs.findIndex(w => w.windowId === windowId);
    
    if (windowIndex !== -1) {
      const windowToArchive = savedTabs[windowIndex];
      
      const archive = {
        id: Date.now(),
        timestamp: new Date().toISOString(),
        name: windowNames[windowId] || `Window ${windowId}`,
        type: 'window',
        windows: [windowToArchive],
        windowNames: { [windowId]: windowNames[windowId] }
      };

      // Add to archives and remove from current
      archivedSessions.push(archive);
      savedTabs.splice(windowIndex, 1);
      delete windowNames[windowId];

      // Update storage
      chrome.storage.local.set({ 
        archivedSessions: archivedSessions,
        savedTabs: savedTabs,
        windowNames: windowNames
      }, function() {
        document.getElementById('status').textContent = "Window archived!";
        setTimeout(() => document.getElementById('status').textContent = "", 2000);
        loadTabs();
      });
    }
  });
}

function showArchivedSessions() {
  const windowsList = document.getElementById('windowsList');
  const searchContainer = document.querySelector('.search-container');
  windowsList.innerHTML = '';

  // Keep search visible and clear it
  const searchInput = document.getElementById('searchTabs');
  searchInput.value = '';

  chrome.storage.local.get(['archivedSessions'], function(result) {
    const archivedSessions = result.archivedSessions || [];
    
    // Add back button
    const backButton = document.createElement('button');
    backButton.className = 'icon-button';
    backButton.innerHTML = '<span class="icon icon-back"></span> Back to Current Session';
    backButton.onclick = loadTabs;
    windowsList.appendChild(backButton);

    // Create sections
    const sections = {
      session: {
        title: 'Archived Sessions',
        archives: archivedSessions.filter(a => a.type === 'session')
      },
      window: {
        title: 'Archived Windows',
        archives: archivedSessions.filter(a => a.type === 'window')
      }
    };

    // Create each section
    Object.entries(sections).forEach(([type, section]) => {
      if (section.archives.length > 0) {
        // Section header
        const sectionHeader = document.createElement('h2');
        sectionHeader.className = 'archive-section-header';
        sectionHeader.textContent = section.title;
        windowsList.appendChild(sectionHeader);

        const sectionList = document.createElement('ul');
        sectionList.className = 'tree-root';

        section.archives.forEach(archive => {
          const archiveLi = createArchiveListItem(archive);
          sectionList.appendChild(archiveLi);
        });

        windowsList.appendChild(sectionList);
      }
    });
  });
}

function createArchiveListItem(archive) {
  const archiveLi = document.createElement('li');
  archiveLi.className = 'tree-window';
  
  const archiveHeader = document.createElement('div');
  archiveHeader.className = 'tree-header';
  
  // Add toggle
  const toggleSpan = document.createElement('span');
  toggleSpan.className = 'tree-toggle icon icon-collapse';
  toggleSpan.addEventListener('click', function(e) {
    e.stopPropagation();
    const isExpanded = this.classList.contains('icon-expand');
    this.className = `tree-toggle icon ${isExpanded ? 'icon-collapse' : 'icon-expand'}`;
    const content = this.parentElement.nextElementSibling;
    content.style.display = isExpanded ? 'none' : 'block';
  });

  // Add editable title
  const archiveTitle = document.createElement('span');
  archiveTitle.className = 'tree-title';
  archiveTitle.setAttribute('data-archive-id', archive.id);
  
  // Create title text and date elements
  const titleText = document.createElement('span');
  titleText.textContent = archive.name;
  titleText.className = 'archive-name';
  
  const dateText = document.createElement('span');
  dateText.textContent = ` (${new Date(archive.timestamp).toLocaleString()})`;
  dateText.className = 'archive-date';
  
  archiveTitle.appendChild(titleText);
  archiveTitle.appendChild(dateText);

  // Add edit functionality
  archiveTitle.addEventListener('dblclick', function(e) {
    if (e.target.classList.contains('archive-date')) return; // Prevent editing date
    
    const nameSpan = this.querySelector('.archive-name');
    const currentName = nameSpan.textContent;
    const input = document.createElement('input');
    input.type = 'text';
    input.value = currentName;
    input.className = 'tree-title-input';
    
    nameSpan.replaceWith(input);
    input.focus();
    input.select();

    function saveAndRevert() {
      const newName = input.value.trim() || currentName;
      nameSpan.textContent = newName;
      input.replaceWith(nameSpan);
      updateArchiveName(archive.id, newName);
    }

    input.addEventListener('keydown', function(e) {
      if (e.key === 'Enter') {
        e.preventDefault();
        saveAndRevert();
      } else if (e.key === 'Escape') {
        nameSpan.textContent = currentName;
        input.replaceWith(nameSpan);
      }
    });

    input.addEventListener('blur', saveAndRevert);
  });

  // Add controls
  const controls = document.createElement('span');
  controls.className = 'tree-controls';
  
  const restoreBtn = document.createElement('button');
  restoreBtn.className = 'tree-btn';
  restoreBtn.innerHTML = '<span class="icon icon-restore"></span>';
  restoreBtn.title = 'Restore Archive';
  restoreBtn.onclick = () => restoreArchivedSession(archive.id);

  const deleteBtn = document.createElement('button');
  deleteBtn.className = 'tree-btn';
  deleteBtn.innerHTML = '<span class="icon icon-delete"></span>';
  deleteBtn.title = 'Delete Archive';
  deleteBtn.onclick = () => deleteArchivedSession(archive.id);

  controls.appendChild(restoreBtn);
  controls.appendChild(deleteBtn);
  
  archiveHeader.appendChild(toggleSpan);
  archiveHeader.appendChild(archiveTitle);
  archiveHeader.appendChild(controls);
  archiveLi.appendChild(archiveHeader);

  // Add content (windows and tabs)
  const archiveContent = createArchiveContent(archive);
  archiveLi.appendChild(archiveContent);

  return archiveLi;
}

function createArchiveContent(archive) {
  const archiveContent = document.createElement('div');
  archiveContent.className = 'tree-content';
  archiveContent.style.display = 'none';  // Initialize as hidden

  // Create windows list
  const windowsList = document.createElement('ul');
  
  archive.windows.forEach(window => {
    const windowLi = document.createElement('li');
    windowLi.className = 'tree-window';
    
    // Window header
    const windowHeader = document.createElement('div');
    windowHeader.className = 'tree-header';
    
    // Window toggle
    const windowToggle = document.createElement('span');
    windowToggle.className = 'tree-toggle icon icon-collapse';
    windowToggle.addEventListener('click', function(e) {
      e.stopPropagation();
      const isExpanded = this.classList.contains('icon-expand');
      this.className = `tree-toggle icon ${isExpanded ? 'icon-collapse' : 'icon-expand'}`;
      const content = this.parentElement.nextElementSibling;
      content.style.display = isExpanded ? 'none' : 'block';
    });
    
    // Window title
    const windowTitle = document.createElement('span');
    windowTitle.className = 'tree-title';
    windowTitle.textContent = archive.windowNames[window.windowId] || `Window ${window.windowId}`;
    
    windowHeader.appendChild(windowToggle);
    windowHeader.appendChild(windowTitle);
    windowLi.appendChild(windowHeader);
    
    // Window content
    const windowContent = document.createElement('div');
    windowContent.className = 'tree-content';
    windowContent.style.display = 'none';  // Initialize as hidden
    
    // Add ungrouped tabs
    if (window.tabs && window.tabs.length > 0) {
      const tabsList = document.createElement('ul');
      window.tabs.forEach(tab => {
        const tabLi = document.createElement('li');
        tabLi.className = 'tree-tab';
        
        const tabContent = document.createElement('div');
        tabContent.className = 'tree-tab-content';
        
        // Add favicon
        if (tab.favIconUrl) {
          const favicon = document.createElement('img');
          favicon.src = tab.favIconUrl;
          favicon.className = 'tree-favicon';
          favicon.onerror = function() {
            const defaultIcon = document.createElement('span');
            defaultIcon.className = 'icon icon-public tree-favicon';
            favicon.replaceWith(defaultIcon);
          };
          tabContent.appendChild(favicon);
        } else {
          const defaultIcon = document.createElement('span');
          defaultIcon.className = 'icon icon-public tree-favicon';
          tabContent.appendChild(defaultIcon);
        }
        
        // Add tab link
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
        
        tabLi.appendChild(tabContent);
        tabsList.appendChild(tabLi);
      });
      windowContent.appendChild(tabsList);
    }
    
    // Add grouped tabs
    if (window.groups) {
      for (const groupId in window.groups) {
        const group = window.groups[groupId];
        
        // Create group container
        const groupLi = document.createElement('li');
        groupLi.className = 'tree-group';
        
        // Group header
        const groupHeader = document.createElement('div');
        groupHeader.className = 'tree-header';
        
        const groupToggle = document.createElement('span');
        groupToggle.className = 'tree-toggle icon icon-collapse';
        groupToggle.addEventListener('click', function(e) {
          e.stopPropagation();
          const isExpanded = this.classList.contains('icon-expand');
          this.className = `tree-toggle icon ${isExpanded ? 'icon-collapse' : 'icon-expand'}`;
          const content = this.parentElement.nextElementSibling;
          content.style.display = isExpanded ? 'none' : 'block';
        });
        
        const groupTitle = document.createElement('span');
        groupTitle.className = 'tree-title';
        groupTitle.textContent = group.title;
        
        groupHeader.appendChild(groupToggle);
        groupHeader.appendChild(groupTitle);
        groupLi.appendChild(groupHeader);
        
        // Group content
        const groupContent = document.createElement('div');
        groupContent.className = 'tree-content';
        groupContent.style.display = 'none';  // Initialize as hidden
        
        // Add group tabs
        const groupTabsList = document.createElement('ul');
        group.tabs.forEach(tab => {
          const tabLi = document.createElement('li');
          tabLi.className = 'tree-tab';
          
          const tabContent = document.createElement('div');
          tabContent.className = 'tree-tab-content';
          
          // Add favicon
          if (tab.favIconUrl) {
            const favicon = document.createElement('img');
            favicon.src = tab.favIconUrl;
            favicon.className = 'tree-favicon';
            favicon.onerror = function() {
              const defaultIcon = document.createElement('span');
              defaultIcon.className = 'icon icon-public tree-favicon';
              favicon.replaceWith(defaultIcon);
            };
            tabContent.appendChild(favicon);
          } else {
            const defaultIcon = document.createElement('span');
            defaultIcon.className = 'icon icon-public tree-favicon';
            tabContent.appendChild(defaultIcon);
          }
          
          // Add tab link
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
          
          tabLi.appendChild(tabContent);
          groupTabsList.appendChild(tabLi);
        });
        
        groupContent.appendChild(groupTabsList);
        groupLi.appendChild(groupContent);
        windowContent.appendChild(groupLi);
      }
    }
    
    windowLi.appendChild(windowContent);
    windowsList.appendChild(windowLi);
  });
  
  archiveContent.appendChild(windowsList);
  return archiveContent;
}

// Function to restore an archived session
function restoreArchivedSession(sessionId) {
  chrome.storage.local.get(['archivedSessions'], function(result) {
    const session = result.archivedSessions.find(s => s.id === sessionId);
    if (session) {
      chrome.storage.local.set({
        savedTabs: session.windows,
        windowNames: session.windowNames
      }, function() {
        loadTabs();
      });
    }
  });
}

// Function to delete an archived session
function deleteArchivedSession(sessionId) {
  chrome.storage.local.get(['archivedSessions'], function(result) {
    const archivedSessions = result.archivedSessions.filter(s => s.id !== sessionId);
    
    // Find and remove the session element from DOM
    const sessionElement = document.querySelector(`[data-archive-id="${sessionId}"]`)?.closest('.tree-window');
    if (sessionElement) {
      // Check if this was the last item in its section
      const section = sessionElement.closest('.tree-root');
      sessionElement.remove();

      // If section is now empty, remove the section header
      if (section && !section.hasChildNodes()) {
        section.previousElementSibling?.remove(); // Remove header
        section.remove(); // Remove empty section
      }
    }

    // Update storage without reloading the view
    chrome.storage.local.set({ archivedSessions: archivedSessions });
  });
}

// Helper function to create archive list items

// Function to update archive name
function updateArchiveName(archiveId, newName) {
  chrome.storage.local.get(['archivedSessions'], function(result) {
    const archivedSessions = result.archivedSessions.map(session => {
      if (session.id === archiveId) {
        return { ...session, name: newName };
      }
      return session;
    });
    
    chrome.storage.local.set({ archivedSessions }, function() {
      document.getElementById('status').textContent = "Archive name updated!";
      setTimeout(() => document.getElementById('status').textContent = "", 2000);
    });
  });
}




/////////////////////////////////////////////////////////////
// Tab State Management Functions
/////////////////////////////////////////////////////////////

function pauseTabsInWindow(windowId) {
  // First get all currently open tabs
  chrome.windows.getAll({ populate: true }, function(windows) {
    // Get saved tabs info
    chrome.storage.local.get(['savedTabs'], function(result) {
      if (result.savedTabs) {
        const windowInfo = result.savedTabs.find(window => window.windowId === windowId);
        if (windowInfo) {
          // Collect all URLs from the saved window
          let savedUrls = new Set();
          
          // Add ungrouped tabs
          windowInfo.tabs.forEach(tab => savedUrls.add(tab.url));
          
          // Add grouped tabs
          if (windowInfo.groups) {
            Object.values(windowInfo.groups).forEach(group => {
              group.tabs.forEach(tab => savedUrls.add(tab.url));
            });
          }

          // Find and discard matching tabs in any open window
          windows.forEach(window => {
            window.tabs.forEach(tab => {
              if (savedUrls.has(tab.url)) {
                console.log('Discarding tab:', tab.url);
                chrome.tabs.discard(tab.id, function(discardedTab) {
                  if (chrome.runtime.lastError) {
                    console.error('Error discarding tab:', chrome.runtime.lastError);
                    return;
                  }
                  
                  // Update UI for this specific tab
                  document.querySelectorAll('.tree-tab').forEach(element => {
                    const link = element.querySelector('a');
                    if (link && link.href === tab.url) {
                      const content = element.querySelector('.tree-tab-content');
                      const indicator = element.querySelector('.pause-indicator');
                      if (content) content.classList.add('paused');
                      if (indicator) indicator.style.opacity = '1';
                    }
                  });
                });
              }
            });
          });

          // Show status message
          document.getElementById('status').textContent = "Tabs paused!";
          setTimeout(() => {
            document.getElementById('status').textContent = "";
          }, 2000);
        }
      }
    });
  });
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



/////////////////////////////////////////////////////////////
// UI/View Management Functions
/////////////////////////////////////////////////////////////

function toggleAllTrees() {
  const toggleIcon = document.getElementById('toggleIcon');
  
  // Check current display state of content instead of icon class
  const firstContent = document.querySelector('.tree-content');
  const isExpanded = firstContent && firstContent.style.display !== 'none';
  
  // Update icon based on what we're about to do (collapse or expand)
  toggleIcon.className = `icon ${isExpanded ? 'icon-unfold-more' : 'icon-unfold-less'}`;
  toggleIcon.parentElement.querySelector('.tooltip').textContent = 
      isExpanded ? 'Expand All' : 'Collapse All';

  // Get all content sections and toggle buttons
  const allContents = document.querySelectorAll('.tree-content');
  const allToggles = document.querySelectorAll('.tree-toggle');

  // Set display state
  const newDisplayState = isExpanded ? 'none' : 'block';
  allContents.forEach(content => {
      content.style.display = newDisplayState;
  });

  // Update toggle icons
  allToggles.forEach(toggle => {
    toggle.className = `tree-toggle icon ${isExpanded ? 'icon-collapse' : 'icon-expand'}`;
  });
}

// Updated filterTabs function
function filterTabs(searchTerm) {
  searchTerm = searchTerm.toLowerCase();
  const isArchiveView = document.querySelector('.archive-section-header') !== null;
  const allTabItems = document.querySelectorAll('.tree-tab');
  const allWindows = document.querySelectorAll('.tree-window');
  const allGroups = document.querySelectorAll('.tree-group');
  const allContents = document.querySelectorAll('.tree-content');
  const sectionHeaders = document.querySelectorAll('.archive-section-header');
  
  // Reset visibility when search is empty
  if (!searchTerm) {
    allTabItems.forEach(item => item.style.display = 'block');
    allWindows.forEach(window => window.style.display = 'block');
    allGroups.forEach(group => group.style.display = 'block');
    sectionHeaders.forEach(header => header.style.display = 'block');
    allContents.forEach(content => content.style.display = 'none'); // Keep trees collapsed
    return;
  }

  // Hide everything initially
  allTabItems.forEach(item => item.style.display = 'none');
  allWindows.forEach(window => window.style.display = 'none');
  allGroups.forEach(group => group.style.display = 'none');
  allContents.forEach(content => content.style.display = 'none');
  if (isArchiveView) {
    sectionHeaders.forEach(header => header.style.display = 'none');
  }

  let hasMatches = false;

  // Search through all tabs
  allTabItems.forEach(tabItem => {
    const tabLink = tabItem.querySelector('a');
    if (!tabLink) return;

    const title = tabLink.textContent.toLowerCase();
    const url = tabLink.href.toLowerCase();
    
    if (title.includes(searchTerm) || url.includes(searchTerm)) {
      hasMatches = true;
      tabItem.style.display = 'block';

      // Show parent elements
      let parent = tabItem.parentElement;
      while (parent) {
        if (parent.classList.contains('tree-content')) {
          parent.style.display = 'block';
        } else if (parent.classList.contains('tree-window')) {
          parent.style.display = 'block';
          // If in archive view, show the section header
          if (isArchiveView) {
            const header = parent.closest('.tree-root')?.previousElementSibling;
            if (header?.classList.contains('archive-section-header')) {
              header.style.display = 'block';
            }
          }
        } else if (parent.classList.contains('tree-group')) {
          parent.style.display = 'block';
        }
        parent = parent.parentElement;
      }
    }
  });

  // If in archive view, also search archive names
  if (isArchiveView) {
    document.querySelectorAll('.archive-name').forEach(nameElem => {
      if (nameElem.textContent.toLowerCase().includes(searchTerm)) {
        hasMatches = true;
        const windowEl = nameElem.closest('.tree-window');
        if (windowEl) {
          windowEl.style.display = 'block';
          // Show the section header
          const header = windowEl.closest('.tree-root')?.previousElementSibling;
          if (header?.classList.contains('archive-section-header')) {
            header.style.display = 'block';
          }
        }
      }
    });
  }

  // Update status message if no matches found
  if (!hasMatches) {
    const status = document.getElementById('status');
    if (status) {
      status.textContent = 'No matching tabs found';
      setTimeout(() => status.textContent = '', 2000);
    }
  }
}




/////////////////////////////////////////////////////////////
// Import/Export Functions
/////////////////////////////////////////////////////////////

function exportTabs() {
  chrome.storage.local.get(['savedTabs'], function(result) {
    if (result.savedTabs) {
      const dataStr = JSON.stringify(result.savedTabs, null, 2);
      const dataBlob = new Blob([dataStr], { type: 'application/json' });
      
      const url = URL.createObjectURL(dataBlob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `TabSaver_${new Date().toISOString().split('T')[0]}.json`;
      link.click();
      
      URL.revokeObjectURL(url);
      document.getElementById('status').textContent = "Tabs exported!";
      setTimeout(() => document.getElementById('status').textContent = "", 2000);
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


