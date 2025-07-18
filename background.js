// Global variables
let autoSaveTimer = null;
let windowTracker = new Map(); // windowId -> { tabs, groups, lastSaved }
let updateTrackerTimeout = null;

// Helper functions
function getIntervalInMs(interval, unit) {
 const minute = 60 * 1000;
 const hour = 60 * minute;
 const day = 24 * hour;

 switch (unit) {
   case 'minutes': return interval * minute;
   case 'hours': return interval * hour;
   case 'days': return interval * day;
   default: return interval * minute;
 }
}

function setupAutoSave(enabled, interval, unit) {
 if (autoSaveTimer) {
   clearInterval(autoSaveTimer);
   autoSaveTimer = null;
 }

 if (enabled && interval > 0) {
   const intervalMs = getIntervalInMs(interval, unit);
   autoSaveTimer = setInterval(saveAllTabs, intervalMs);
 }
}


async function saveAllTabs() {
    const settings = await chrome.storage.sync.get({
      maxAutosaveCount: 10
    });
  
    const savedData = await new Promise((resolve) => {
      chrome.storage.local.get(['windowNames'], function(result) {
        const windowNames = result.windowNames || {};
        
        chrome.windows.getAll({ populate: true }, function(windows) {
          let savedTabs = [];
          let processedWindows = 0;
          
          windows.forEach(function(window) {
            let windowData = {
              windowId: window.id,
              tabs: [],
              groups: {}
            };
  
            chrome.tabGroups.query({ windowId: window.id }, function(groups) {
              groups.forEach(group => {
                windowData.groups[group.id] = {
                  title: group.title,
                  color: group.color,
                  tabs: []
                };
              });
  
              window.tabs.forEach(function(tab) {
                const tabData = {
                  url: tab.url,
                  title: tab.title,
                  favIconUrl: getSafeFaviconUrl(tab),
                  discarded: tab.discarded || false
                };
  
                if (tab.groupId > -1) {
                  if (windowData.groups[tab.groupId]) {
                    windowData.groups[tab.groupId].tabs.push(tabData);
                  }
                } else {
                  windowData.tabs.push(tabData);
                }
              });
  
              savedTabs.push(windowData);
              processedWindows++;
  
              if (processedWindows === windows.length) {
                resolve({ savedTabs, windowNames });
              }
            });
          });
        });
      });
    });
  
    if (settings.maxAutosaveCount > 0) {
      const autosaves = (await chrome.storage.local.get(['autoSavedSessions'])).autoSavedSessions || [];
      
      const newAutosave = {
        timestamp: new Date().toISOString(),
        savedTabs: savedData.savedTabs || [],
        windowNames: savedData.windowNames || {}
      };
      
      autosaves.unshift(newAutosave);
      while (autosaves.length > settings.maxAutosaveCount) {
        autosaves.pop();
      }
      
      await chrome.storage.local.set({ 
        autoSavedSessions: autosaves,
        savedTabs: savedData.savedTabs,
        windowNames: savedData.windowNames
      });
    } else {
      await chrome.storage.local.set({ 
        savedTabs: savedData.savedTabs,
        windowNames: savedData.windowNames
      });
    }

    // Update the window tracker after saving
    updateWindowTracker();
}

// NEW CODE (with proper protocol checking):
function getSafeFaviconUrl(tab) {
  // If the tab already has a valid favicon, use it
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
      return null; // Will fallback to default icon in UI
    }
    
    // For regular web pages, use chrome://favicon
    if (protocol === 'http:' || protocol === 'https:') {
      return `chrome://favicon/${tab.url}`;
    }
    
    // For anything else, don't generate a favicon URL
    return null;
    
  } catch (e) {
    // If URL parsing fails, don't generate a favicon
    return null;
  }
}

// Event Listeners
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === "saveTabs") {
    saveAllTabs().then(() => {
      sendResponse({ status: "success" });
    }).catch(error => {
      sendResponse({ status: "error", message: error.message });
    });
    return true;
  } else if (message.action === 'updateAutoSave') {
    setupAutoSave(
      message.settings.autoSave,
      message.settings.autoSaveInterval,
      message.settings.autoSaveUnit
    );
  }
});

// Listen for tab state changes
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
 console.log('Tab updated:', {tabId, changeInfo, tab});
 
 if (changeInfo.hasOwnProperty('discarded')) {
   console.log('Discarded state changed:', {
     tabId,
     url: tab.url,
     discarded: changeInfo.discarded
   });
   
   chrome.runtime.sendMessage({
     action: "tabStateChanged",
     tabId: tabId,
     url: tab.url,
     discarded: changeInfo.discarded
   }, () => {
     if (chrome.runtime.lastError) {
       // Handle error silently - popup might not be open
     }
   });
 }
});

// Initialize autosave on startup
chrome.storage.sync.get({
 autoSave: false,
 autoSaveInterval: 15,
 autoSaveUnit: 'minutes'
}, function(items) {
 if (items.autoSave) {
   setupAutoSave(true, items.autoSaveInterval, items.autoSaveUnit);
 }
});










// Auto Archive on Close



// Function to update window tracker when tabs are saved
function updateWindowTracker() {
  // Debounce to prevent excessive calls
  if (updateTrackerTimeout) {
    clearTimeout(updateTrackerTimeout);
  }
  
  updateTrackerTimeout = setTimeout(() => {
    try {
      chrome.windows.getAll({ populate: true }, function(windows) {
        // Add error checking
        if (chrome.runtime.lastError) {
          console.error('Error getting windows:', chrome.runtime.lastError);
          return;
        }
        
        // Check if windows is defined and is an array
        if (!windows || !Array.isArray(windows)) {
          console.log('No windows returned or invalid data:', windows);
          return;
        }
        
        // If no windows, clear the tracker
        if (windows.length === 0) {
          windowTracker.clear();
          return;
        }
        
        windows.forEach(function(window) {
          // Safety check for window object
          if (!window || !window.id) {
            console.log('Invalid window object:', window);
            return;
          }
          
          const windowData = {
            windowId: window.id,
            tabs: [],
            groups: {},
            lastSaved: Date.now()
          };

          // Get tab groups for this window
          chrome.tabGroups.query({ windowId: window.id }, function(groups) {
            // Add error checking for tabGroups query
            if (chrome.runtime.lastError) {
              console.error('Error getting tab groups:', chrome.runtime.lastError);
              // Continue without groups
              groups = [];
            }
            
            // Safety check for groups
            if (groups && Array.isArray(groups)) {
              groups.forEach(group => {
                if (group && group.id) {
                  windowData.groups[group.id] = {
                    title: group.title || '',
                    color: group.color || 'grey',
                    tabs: []
                  };
                }
              });
            }

            // Process tabs - add safety check
            if (window.tabs && Array.isArray(window.tabs)) {
              window.tabs.forEach(function(tab) {
                // Safety check for tab object
                if (!tab || !tab.url) {
                  return; // Skip invalid tabs
                }
                
                const tabData = {
                  url: tab.url,
                  title: tab.title || tab.url,
                  favIconUrl: getSafeFaviconUrl(tab),
                  discarded: tab.discarded || false
                };

                if (tab.groupId && tab.groupId > -1) {
                  if (windowData.groups[tab.groupId]) {
                    windowData.groups[tab.groupId].tabs.push(tabData);
                  }
                } else {
                  windowData.tabs.push(tabData);
                }
              });
            }

            // Store in tracker
            windowTracker.set(window.id, windowData);
          });
        });
      });
    } catch (error) {
      console.error('Error in updateWindowTracker:', error);
    }
    
    updateTrackerTimeout = null;
  }, 500); // 500ms debounce delay
}

// Function to archive a window
async function archiveClosedWindow(windowId) {
  try {
    // Get current settings
    const { autoArchive } = await chrome.storage.sync.get(['autoArchive']);
    if (!autoArchive) {
      return; // Auto-archive is disabled
    }

    // Get window data from tracker
    const windowData = windowTracker.get(windowId);
    if (!windowData) {
      console.log(`No tracked data for window ${windowId}`);
      return;
    }

    // Check if window has any tabs worth archiving
    const totalTabs = windowData.tabs.length + 
      Object.values(windowData.groups).reduce((sum, group) => sum + group.tabs.length, 0);
    
    if (totalTabs === 0) {
      console.log(`Window ${windowId} has no tabs to archive`);
      windowTracker.delete(windowId);
      return;
    }

    // Get existing data
    const result = await chrome.storage.local.get(['archivedSessions', 'windowNames']);
    const archivedSessions = result.archivedSessions || [];
    const windowNames = result.windowNames || {};

    // Create archive entry
    const archive = {
      id: Date.now(),
      timestamp: new Date().toISOString(),
      name: windowNames[windowId] || `Window ${windowId} (Auto-archived)`,
      type: 'window',
      windows: [windowData],
      windowNames: { [windowId]: windowNames[windowId] || `Window ${windowId}` }
    };

    // Add to archives
    archivedSessions.push(archive);

    // Save to storage
    await chrome.storage.local.set({ archivedSessions: archivedSessions });

    console.log(`Window ${windowId} auto-archived successfully`);
    
    // Clean up tracker
    windowTracker.delete(windowId);

  } catch (error) {
    console.error('Error auto-archiving window:', error);
    // Clean up tracker even if archiving failed
    windowTracker.delete(windowId);
  }
}

// Listen for window close events
chrome.windows.onRemoved.addListener((windowId) => {
  console.log(`Window ${windowId} closed, checking for auto-archive`);
  archiveClosedWindow(windowId);
});

// Listen for window creation to start tracking
chrome.windows.onCreated.addListener((window) => {
  console.log(`Window ${window.id} created`);
  // Update tracker after a short delay to allow tabs to load
  setTimeout(() => {
    updateWindowTracker();
  }, 1000);
});

// Listen for tab changes to update tracker
chrome.tabs.onCreated.addListener((tab) => {
  setTimeout(() => {
    updateWindowTracker();
  }, 500);
});

chrome.tabs.onRemoved.addListener((tabId, removeInfo) => {
  setTimeout(() => {
    updateWindowTracker();
  }, 500);
});

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  // Only update tracker for significant changes
  if (changeInfo.url || changeInfo.title) {
    setTimeout(() => {
      updateWindowTracker();
    }, 500);
  }
});


// Initialize tracker on startup
chrome.runtime.onStartup.addListener(() => {
  setTimeout(() => {
    updateWindowTracker();
  }, 2000);
});

chrome.runtime.onInstalled.addListener(() => {
  setTimeout(() => {
    updateWindowTracker();
  }, 2000);
});

// Periodic tracker update (every 5 minutes) to catch any missed changes
setInterval(() => {
  updateWindowTracker();
}, 5 * 60 * 1000);


