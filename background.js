chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
  if (request.action === "saveTabs") {
      chrome.windows.getAll({ populate: true }, function(windows) {
          let savedTabs = [];
          
          windows.forEach(function(window) {
              let windowData = {
                  windowId: window.id,
                  tabs: [],
                  groups: {}
              };

              // Get all tab groups in the window
              chrome.tabGroups.query({ windowId: window.id }, function(groups) {
                  groups.forEach(group => {
                      windowData.groups[group.id] = {
                          title: group.title,
                          color: group.color,
                          tabs: []
                      };
                  });

                  // Process all tabs with detailed logging
                  window.tabs.forEach(function(tab) {
                      console.log('Processing tab:', {
                          title: tab.title,
                          url: tab.url,
                          originalFavIconUrl: tab.favIconUrl
                      });

                      // Create tab data with guaranteed favicon URL
                      const tabData = {
                          url: tab.url,
                          title: tab.title,
                          favIconUrl: tab.favIconUrl || `chrome://favicon/${tab.url}`
                      };

                      console.log('Created tab data:', tabData);

                      if (tab.groupId > -1) {
                          // Tab is part of a group
                          if (windowData.groups[tab.groupId]) {
                              windowData.groups[tab.groupId].tabs.push(tabData);
                          }
                      } else {
                          // Tab is not in a group
                          windowData.tabs.push(tabData);
                      }
                  });

                  savedTabs.push(windowData);
                  
                  // Save to storage with logging
                  chrome.storage.local.set({ savedTabs: savedTabs }, function() {
                      console.log('Tabs saved with data:', savedTabs);
                      if (chrome.runtime.lastError) {
                          console.error('Error saving tabs:', chrome.runtime.lastError);
                          sendResponse({ status: "error", message: chrome.runtime.lastError.message });
                      } else {
                          sendResponse({ status: "success" });
                      }
                  });
              });
          });
      });
      return true; // Keep the message channel open for async response
  }
});