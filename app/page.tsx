"use client";

import { useState, useEffect, ChangeEvent, FormEvent } from "react";

interface ProductConfig {
  id: string;
  name: string;
  xmlFile: string;
  // filenamePattern removed as it's no longer used on client for link generation
}

const products: ProductConfig[] = [
  { id: 'ws-windows', name: 'VMware Workstation Pro for Windows', xmlFile: 'ws-windows.xml' },
  { id: 'ws-linux', name: 'VMware Workstation Pro for Linux', xmlFile: 'ws-linux.xml' },
  { id: 'fusion-universal', name: 'VMware Fusion Pro for macOS (Universal)', xmlFile: 'fusion-universal.xml' },
  { id: 'fusion-arm64', name: 'VMware Fusion Pro for macOS (ARM64)', xmlFile: 'fusion-arm64.xml' },
  { id: 'fusion-intel', name: 'VMware Fusion Pro for macOS (Intel)', xmlFile: 'fusion.xml' },
  { id: 'player-linux', name: 'VMware Player for Linux', xmlFile: 'player-linux.xml' },
  { id: 'player-windows', name: 'VMware Player for Windows', xmlFile: 'player-windows.xml' },
  { id: 'vmrc-linux', name: 'VMware Remote Console for Linux', xmlFile: 'vmrc-linux.xml' },
  { id: 'vmrc-macos', name: 'VMware Remote Console for macOS', xmlFile: 'vmrc-macos.xml' },
  { id: 'vmrc-windows', name: 'VMware Remote Console for Windows', xmlFile: 'vmrc-windows.xml' },
];

// Interface for data from /api/getProductVersions (should match server)
interface SelectableVersion {
  idForClientSelection: string;
  displayVersion: string;
  version: string;
  build: string;
  platformOrArch: string;
  gzFilePath: string; // Added to store the path to the metadata.xml.gz file
  // coreMetadataUrlPath and initialPathFragment are not directly sent to client by this API anymore
}

// Interface for data from /api/download-details (this is an array of items)
interface DownloadableItem {
  name: string;
  pathFragment: string;
  finalFileName: string;
  checksumType?: string; // Changed from hash to checksumType
  checksumValue?: string; // Added checksumValue
}

// const BASE_XML_URL = "https://softwareupdate-prod.broadcom.com/cds/vmw-desktop/"; // Not needed
const BASE_DOWNLOAD_URL = "https://softwareupdate-prod.broadcom.com/cds/vmw-desktop/";

export default function Home() {
  const [selectedProductId, setSelectedProductId] = useState<string>("");
  const [versions, setVersions] = useState<SelectableVersion[]>([]); // Use corrected interface
  const [selectedVersionKey, setSelectedVersionKey] = useState<string>(""); // Stores idForClientSelection
  const [downloadItems, setDownloadItems] = useState<DownloadableItem[]>([]);
  const [isLoadingVersions, setIsLoadingVersions] = useState<boolean>(false);
  const [isLoadingDetails, setIsLoadingDetails] = useState<boolean>(false);
  const [error, setError] = useState<string>("");
  const [copiedLinkIndex, setCopiedLinkIndex] = useState<number | null>(null);

  // Effect to fetch version list when product changes
  useEffect(() => {
    if (!selectedProductId) {
      setVersions([]);
      setSelectedVersionKey("");
      setDownloadItems([]);
      setError("");
      return;
    }

    const fetchProductVersionList = async () => {
      setIsLoadingVersions(true);
      setError("");
      setVersions([]);
      setSelectedVersionKey("");
      setDownloadItems([]);

      try {
        const response = await fetch(`/api/getProductVersions?productId=${selectedProductId}`);
        if (!response.ok) {
          const errorData = await response.json().catch(() => ({ error: `Failed to fetch versions list (${response.status})` }));
          throw new Error(errorData.error || `Failed to fetch versions list (${response.status})`);
        }
        const fetchedData: SelectableVersion[] | { error?: string, versions?: SelectableVersion[] } = await response.json();

        if ('error' in fetchedData && fetchedData.error) {
            setError(fetchedData.error);
            setVersions(fetchedData.versions || []);
        } else if (Array.isArray(fetchedData)) {
            setVersions(fetchedData);
            if (fetchedData.length === 0) {
                setError("No versions found for this product.");
            }
        } else {
            throw new Error("Received invalid data structure for versions list from API.");
        }
      } catch (e: any) {
        setError(`Error fetching versions list: ${e.message}`);
        console.error("Error in fetchProductVersionList:", e);
      } finally {
        setIsLoadingVersions(false);
      }
    };

    fetchProductVersionList();
  }, [selectedProductId]);

  // Function to handle fetching and displaying downloadable items
  const handleShowDownloadableItems = async (e: FormEvent) => {
    e.preventDefault();
    setError("");
    setDownloadItems([]);

    if (!selectedProductId || !selectedVersionKey) {
      setError("Please select both a product and a version.");
      return;
    }

    const selectedVersionData = versions.find(v => v.idForClientSelection === selectedVersionKey);
    if (!selectedVersionData) {
      setError("Selected version details not found. Please re-select.");
      setIsLoadingDetails(false); // Ensure loading state is reset
      return;
    }

    setIsLoadingDetails(true);
    try {
      const apiUrl = `/api/download-details?productId=${selectedProductId}&version=${selectedVersionData.version}&build=${selectedVersionData.build}&platformOrArch=${selectedVersionData.platformOrArch}&gzFilePath=${encodeURIComponent(selectedVersionData.gzFilePath)}`;
      const response = await fetch(apiUrl);
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: `Failed to fetch download items (${response.status})` }));
        throw new Error(errorData.error || `Failed to fetch download items (${response.status})`);
      }
      
      const fetchedItemsData: DownloadableItem[] | { error?: string, items?: DownloadableItem[] } = await response.json();

      if ('error' in fetchedItemsData && fetchedItemsData.error) {
          setError(fetchedItemsData.error);
          setDownloadItems(fetchedItemsData.items || []);
      } else if (Array.isArray(fetchedItemsData)) {
          setDownloadItems(fetchedItemsData);
           if (fetchedItemsData.length === 0) {
                setError("No downloadable items found for this version.");
            }
      } else {
          throw new Error("Received invalid data structure for download items.");
      }

    } catch (e: any) {
      setError(`Error fetching download items: ${e.message}`);
      console.error("Error in handleShowDownloadableItems:", e);
    } finally {
      setIsLoadingDetails(false);
    }
  };

  return (
    <div className="container mx-auto p-4 sm:p-8 min-h-screen font-sans">
      <div className="max-w-3xl mx-auto bg-red-100 border-l-4 border-red-500 text-red-700 p-4 rounded-md shadow-lg mb-8" role="alert">
        <p className="font-bold">Service Disruption Notice</p>
        <p>The DNS record for <code>softwareupdate-prod.broadcom.com</code> has been removed, making the upstream data source for this project unavailable. As a result, all product information and download link generation features are <strong>temporarily out of service</strong>. The timeline for restoration is unknown.</p>
      </div>

      <header className="mb-10">
        <h1 className="text-2xl sm:text-3xl font-bold text-center text-gray-800 dark:text-gray-200">VMware Product Download Link Generator</h1>
        <p className="text-center text-gray-600 dark:text-gray-400 mt-2">Select a product and version to get the official download link.</p>
      </header>

      <form onSubmit={handleShowDownloadableItems} className="max-w-lg mx-auto bg-white dark:bg-[#121212] p-6 sm:p-8 rounded-xl shadow-lg">
        {error && <p className="text-red-600 dark:text-red-400 bg-red-100 dark:bg-red-900 p-3 rounded-md mb-4 text-sm">{error}</p>}

        <div className="mb-6">
          <label htmlFor="product-select" className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1">
            Product:
          </label>
         <select
            id="product-select"
            value={selectedProductId}
            onChange={(e: ChangeEvent<HTMLSelectElement>) => {
              setSelectedProductId(e.target.value);
              setSelectedVersionKey("");
              setDownloadItems([]);
            }}
            className="mt-1 block w-full pl-3 pr-10 py-2.5 text-base border-gray-300 dark:border-gray-700 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm rounded-md shadow-sm appearance-none bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
          >
            <option value="">-- Select a Product --</option>
            {products.map(p => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
        </div>

        {selectedProductId && (
          <div className="mb-6">
            <label htmlFor="version-select" className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1">
              Version:
            </label>
            {isLoadingVersions ? (
              <div className="mt-1 block w-full pl-3 pr-10 py-2.5 text-gray-500 border border-gray-300 dark:border-gray-700 rounded-md shadow-sm bg-gray-50 dark:bg-gray-950">Loading versions...</div>
            ) : versions.length > 0 ? (
              <select
                id="version-select"
                value={selectedVersionKey}
                onChange={(e: ChangeEvent<HTMLSelectElement>) => {
                  setSelectedVersionKey(e.target.value);
                  setDownloadItems([]); // Reset download items on version change
                }}
                className="mt-1 block w-full pl-3 pr-10 py-2.5 text-base border-gray-300 dark:border-gray-700 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm rounded-md shadow-sm appearance-none bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                disabled={isLoadingVersions}
              >
                <option value="">-- Select a Version --</option>
                {versions.map(v => (
                  <option key={v.idForClientSelection} value={v.idForClientSelection}>{v.displayVersion}</option>
                ))}
              </select>
            ) : !isLoadingVersions && selectedProductId && (!error || versions.length === 0) ? (
                 <div className="mt-1 block w-full pl-3 pr-10 py-2.5 text-gray-500 border border-gray-300 rounded-md shadow-sm bg-gray-50">
                   {error && versions.length === 0 ? "Could not load versions." : "No versions found for this product."}
                 </div>
            ) : null }
          </div>
        )}

        <button
          type="submit"
          className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2.5 px-4 rounded-md shadow-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-opacity-60 disabled:opacity-60 disabled:cursor-not-allowed"
          disabled={isLoadingVersions || isLoadingDetails || !selectedProductId || !selectedVersionKey}
        >
          {isLoadingDetails ? "Fetching Details..." : "Show Downloadable Files"}
        </button>
      </form>

      {downloadItems.length > 0 && (
        <div className="mt-10 max-w-xl mx-auto bg-gray-50 dark:bg-gray-950 p-5 rounded-xl shadow-lg">
          <h2 className="text-xl font-semibold text-gray-800 dark:text-gray-200 mb-4">Downloadable Files:</h2>
          <ul className="space-y-3">
            {downloadItems.map((item, index) => {
              const fullLink = `${BASE_DOWNLOAD_URL}${item.pathFragment}${item.finalFileName}`;
              return (
                <li key={index} className="p-3 bg-white dark:bg-black rounded-md shadow border border-gray-200 dark:border-gray-800">
                  <p className="font-medium text-gray-700 dark:text-gray-300 break-all">{item.name}</p>
                  {item.checksumType && item.checksumValue && (
                    <p className="text-xs text-gray-500 break-all mt-0.5">
                      {item.checksumType}: {item.checksumValue}
                    </p>
                  )}
                  <a
                    href={fullLink}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 break-all underline block my-1"
                  >
                    {fullLink}
                  </a>
                  <button
                    onClick={async () => {
                      try {
                        await navigator.clipboard.writeText(fullLink);
                        setCopiedLinkIndex(index);
                        setTimeout(() => setCopiedLinkIndex(null), 2000); // Reset after 2 seconds
                      } catch (err) {
                        console.error("Failed to copy link: ", err);
                        // Optionally, inform the user about the copy failure, though it's often due to browser restrictions/permissions.
                      }
                    }}
                    className={`mt-1 text-xs font-medium py-1 px-2.5 rounded-md shadow transition-colors duration-150 ease-in-out ${
                      copiedLinkIndex === index
                        ? "bg-green-500 hover:bg-green-600 text-white"
                        : "bg-gray-200 hover:bg-gray-300 text-gray-700"
                    }`}
                    title={copiedLinkIndex === index ? "Copied!" : "Copy Link"}
                    disabled={copiedLinkIndex === index}
                  >
                    {copiedLinkIndex === index ? "Copied!" : "Copy Link"}
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      )}
      
      <footer className="text-center mt-16 mb-8 text-xs text-gray-500">
        <p>Data is sourced from official Broadcom/VMware update servers.</p>
        <p>This tool is provided as-is for convenience. All trademarks are property of their respective owners.</p>
        <p className="mt-2 flex items-center justify-center">
          Love this tool? Give it a star on <a href="https://github.com/moonheart/vmware-index" target="_blank" rel="noopener noreferrer" className="ml-1 mr-1 underline hover:text-blue-600 dark:hover:text-blue-400 inline-flex items-center">
            <svg width="16" height="16" xmlns="http://www.w3.org/2000/svg" fill="currentColor" className="inline-block h-4 w-4 mr-1 align-middle" viewBox="0 0 98 96">
              <path fillRule="evenodd" clipRule="evenodd" d="M48.854 0C21.839 0 0 22 0 49.217c0 21.756 13.993 40.172 33.405 46.69 2.427.49 3.316-1.059 3.316-2.362 0-1.141-.08-5.052-.08-9.127-13.59 2.934-16.42-5.867-16.42-5.867-2.184-5.704-5.42-7.17-5.42-7.17-4.448-3.015.324-3.015.324-3.015 4.934.326 7.523 5.052 7.523 5.052 4.367 7.496 11.404 5.378 14.235 4.074.404-3.178 1.699-5.378 3.074-6.6-10.839-1.141-22.243-5.378-22.243-24.283 0-5.378 1.94-9.778 5.014-13.2-.485-1.222-2.184-6.275.486-13.038 0 0 4.125-1.304 13.426 5.052a46.97 46.97 0 0 1 12.214-1.63c4.125 0 8.33.571 12.213 1.63 9.302-6.356 13.427-5.052 13.427-5.052 2.67 6.763.97 11.816.485 13.038 3.155 3.422 5.015 7.822 5.015 13.2 0 18.905-11.404 23.06-22.324 24.283 1.78 1.548 3.316 4.481 3.316 9.126 0 6.6-.08 11.897-.08 13.526 0 1.304.89 2.853 3.316 2.364 19.412-6.52 33.405-24.935 33.405-46.691C97.707 22 75.788 0 48.854 0z" ></path>
            </svg>
            GitHub
          </a>!
        </p>
      </footer>
    </div>
  );
}
