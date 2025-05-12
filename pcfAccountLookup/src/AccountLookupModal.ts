import * as React from "react";
import { useState, useEffect, useRef } from "react";
import Modal from "react-modal";
import CustomFramework, {
  EntityReference,
  IInputs,
  IOutputs,
} from "../generated/CustomTypes";
import "../css/AccountLookupModal.css";
// import "../css/reactTable.css";
import {
  ColumnDef,
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  getPaginationRowModel,
  useReactTable,
  HeaderGroup,
  Row,
  Cell,
} from "@tanstack/react-table";
import _ from "lodash";

interface AccountLookupModalProps {
  context: ComponentFramework.Context<IInputs>;
  notifyOutputChanged: () => void;
  value: EntityReference | null;
  onChange: (newValue: CustomFramework.EntityReference) => void;
  filterCriteria: string | undefined;
  disabled: boolean | undefined;
}

interface Owner {
  ownerid: string;
  fullname: string; // Full name of the owner
  systemuserid: string; // Type of the owner (user or team)
}

interface parentAccount {
  name: string;
  accountid: string;
}

type parentAccountArray = parentAccount[];

interface Account {
  accountid: string;
  name: string;
  address1_city: string;
  vsi_totalsales: number;
  amc01_erp_s2kcustomeracct: string;
  amc01_erp_s2kshiptoacct: string;
  owninguser: Owner;
  address1_stateorprovince: string;
  account_parent_account : parentAccount;
  vsi_billtoshiptotype : string;
  "vsi_billtoshiptotype@OData.Community.Display.V1.FormattedValue" : string;
  "_parentaccountid_value@OData.Community.Display.V1.FormattedValue": string;
}

interface fetchProps {
  name: string;
  city: string;
  s2kCustomer: string;
  s2kShipTo: string;
}

// Define column definitions with sorting enabled
const columns: ColumnDef<Account>[] = [
  {
    accessorKey: "vsi_billtoshiptotype",
    header: "BillTo / ShipTo Type",
    cell: (info) => {
      // Get the entire row object
      const field = info.row.original;
      
      // Check and render the formatted value
      return field["vsi_billtoshiptotype@OData.Community.Display.V1.FormattedValue"] || "";
    },
    
  },
  {
    accessorKey: "name",
    header: "Account Name",
    cell: (info) => info.getValue(),
  },
  {
    accessorKey: "address1_city",
    header: "City",
    cell: (info) => info.getValue(),
  },
  {
    accessorKey: "address1_stateorprovince",
    header: "State",
    cell: (info) => info.getValue(),
  },
  {
    accessorKey: "vsi_totalsales",
    header: "Total Sales",
    cell: (info) => {
      const value = info.getValue(); // Get the raw value
      const roundedValue = Math.round(Number(value)); // Round off the number
      const formattedValue = `$${new Intl.NumberFormat('en-US').format(roundedValue)}`; // Add commas and dollar sign
      return formattedValue; // Return the formatted value
    },
  },
  {
    accessorKey: "amc01_erp_s2kcustomeracct",
    header: "S2k Cust",
    cell: (info) => info.getValue(),
  },
  {
    accessorKey: "amc01_erp_s2kshiptoacct",
    header: "S2k Ship",
    cell: (info) => info.getValue(),
  },
  {
    accessorKey: "_parentaccountid_value",
    header: "Parent Account",
    cell: (info) => {
       // Get the entire row object
       const field = info.row.original;
      
       // Check and render the formatted value
       return field["_parentaccountid_value@OData.Community.Display.V1.FormattedValue"] || "";
    },
  },
  {
    accessorKey: "owninguser",
    header: "Owner",
    cell: (info) => {
      const owner = info.getValue() as Owner; // Get the 'owner' object
      return owner?.fullname || "N/A"; // Safely access 'fullname'
    },
  },
];

const AccountLookupModal = (props: AccountLookupModalProps) => {

  const [inputValue, setInputValue] = useState<string>(
    props?.value?.name || ""
  );
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [nameSearch, setNameSearch] = useState<string>(
    inputValue ? inputValue : props.value?.name || ""
  );
  const [citySearch, setCitySearch] = useState<string>("");
  const [s2kCustomerAccountSearch, setS2kCustomerAccountSearch] =
    useState<string>("");
  const [s2kShipToAccountSearch, setS2kShipToAccountSearch] =
    useState<string>("");
  let debounceTimer: NodeJS.Timeout; // Declare the debounce timer here
  const [selectedRecordId, setSelectedRecordId] = useState(
    props.value?.id || ""
  );
  const [nextLink, setNextLink] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState<boolean>(true);


  // Initialize the table with sorting and pagination hooks
  const table = useReactTable({
    data: accounts,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    initialState: {
      sorting: [],
    },
  });

  useEffect(() => {
    setInputValue(props.value?.name || "");
    // setNameSearch(props.value);
  }, [props.value]);

  // addition when memory leakage is posible
  // useEffect(() => {
  //   return () => {
  //     clearTimeout(debounceTimer); // Cleanup on unmount
  //   };
  // }, []);

  const fetchAccounts = async ({
    name,
    city,
    s2kCustomer,
    s2kShipTo,
  }: fetchProps, isSearch : boolean): Promise<void> => {
    try {
      setLoading(true);

      const clientUrl = (
        window as any
      ).Xrm.Utility.getGlobalContext().getClientUrl();

      let filterParts: string[] = []; // Use an array to store individual conditions

      if (name.length > 0) {
        filterParts.push(`contains(name,'${name}')`);
      }

      if (s2kCustomer.length > 0) {
        filterParts.push(
          `contains(amc01_erp_s2kcustomeracct,'${s2kCustomer}')`
        );
      }

      if (s2kShipTo.length > 0) {
        filterParts.push(`contains(amc01_erp_s2kshiptoacct,'${s2kShipTo}')`);
      }

      // Add condition to include only active accounts
      filterParts.push(`statecode eq 0`); // Only active accounts

      filterParts.push(`${props.filterCriteria}`);

      // Join the conditions with 'and' only if there are multiple filters
      let filter =
        filterParts.length > 0 ? `&$filter=${filterParts.join(" and ")}` : "";

      // console.log("filter", filter);

      const url = nextLink && !isSearch 
        ? nextLink 
        : `${clientUrl}/api/data/v9.2/accounts?$select=_parentaccountid_value,vsi_billtoshiptotype,address1_stateorprovince,vsi_totalsales,address1_city,accountid,name,amc01_erp_s2kcustomeracct,amc01_erp_s2kshiptoacct,_ownerid_value&$expand=preferredsystemuserid($select=fullname),owninguser($select=fullname,systemuserid),account_parent_account($select=name)${filter}&$orderby=createdon asc`;

      const req = new XMLHttpRequest();
      req.open("GET", url, true);

      req.setRequestHeader("OData-MaxVersion", "4.0");
      req.setRequestHeader("OData-Version", "4.0");
      req.setRequestHeader("Content-Type", "application/json; charset=utf-8");
      req.setRequestHeader("Accept", "application/json");
      req.setRequestHeader("Prefer", "odata.include-annotations=*,odata.maxpagesize=100");
      req.onreadystatechange = function () {
        if (this.readyState === 4) {
          req.onreadystatechange = null;

          if (this.status === 200) {
            const response = JSON.parse(this.responseText);
            

            // Reset accounts for search, append for pagination
          if (isSearch) {
            setAccounts(response.value); // Replace previous records
            setNextLink(null); // Reset pagination
          } else {
            // setAccounts((prev) => [...prev, ...response.value]); // Append new records
            setAccounts((prev) => {
              const existingIds = new Set(prev.map((record: Account) => record.accountid));
              const filteredRecords = response.value.filter(
                (record : Account) => !existingIds.has(record.accountid)
              );
              return [...prev, ...filteredRecords];
            });
            
          }

            // Update nextLink or end pagination if no more data
            if (response["@odata.nextLink"]) {
              setNextLink(response["@odata.nextLink"]);
          
            } else {
              setHasMore(false);
            }


            // setIsModalOpen(true);
          } else {
            console.error(this.responseText);
          }

          // Set loading to false after the API response (success or error)
          setLoading(false);
        }
      };
      req.send();
    } catch (error) {
      console.error("Error fetching accounts:", error);
      // Ensure loading state is stopped on error
      setLoading(false);
    }
  };

  function debouncedFetchAccounts(
    func: (args: fetchProps, isSearch : boolean) => Promise<void>, // Function that matches the expected signature
    delay: number
  ) {
    return (args: fetchProps, isSearch : boolean) => {
      clearTimeout(debounceTimer); // Clear the previous timer
      debounceTimer = setTimeout(() => func(args, isSearch), delay); // Call the function after the delay
    };
  }

  const handleInputChange = (
    e: React.ChangeEvent<HTMLInputElement>,
    field: "name" | "city" | "s2kCustomer" | "s2kShipTo"
  ) => {
    const { value } = e.target;

    switch (field) {
      case "name":
        setInputValue(value);
        props.onChange({ id: "", name: value, entityType: "" });
        setNameSearch(value);
        break;

      case "city":
        setCitySearch(value);
        break;

      case "s2kCustomer":
        setS2kCustomerAccountSearch(value);
        break;

      case "s2kShipTo":
        setS2kShipToAccountSearch(value);
        break;

      default:
        break;
    }

    debouncedFetchAccounts(
      fetchAccounts,
      300
    )({
      name: field === "name" ? value : nameSearch,
      city: field === "city" ? value : citySearch,
      s2kCustomer: field === "s2kCustomer" ? value : s2kCustomerAccountSearch,
      s2kShipTo: field === "s2kShipTo" ? value : s2kShipToAccountSearch,
    }, true);
  };

  const handleInputPaste = (
    e: React.ClipboardEvent<HTMLInputElement>,
    field: "name" | "city" | "s2kCustomer" | "s2kShipTo"
  ) => {

    const pastedValue = e.clipboardData.getData("text").trim();
    // console.log("Pasted Value", pastedValue);

    // switch (field) {
    //   case "name":
    //     setInputValue(pastedValue);
    //     props.onChange({ id: "", name: pastedValue, entityType: "" });
    //     setNameSearch(pastedValue);
    //     break;
  
    //   case "city":
    //     setCitySearch(pastedValue);
    //     break;
  
    //   case "s2kCustomer":
    //     setS2kCustomerAccountSearch(pastedValue);
    //     break;
  
    //   case "s2kShipTo":
    //     setS2kShipToAccountSearch(pastedValue);
    //     break;
  
    //   default:
    //     break;
    // }
  
    debouncedFetchAccounts(
      fetchAccounts,
      300
    )({
      name: field === "name" ? pastedValue : nameSearch,
      city: field === "city" ? pastedValue : citySearch,
      s2kCustomer: field === "s2kCustomer" ? pastedValue : s2kCustomerAccountSearch,
      s2kShipTo: field === "s2kShipTo" ? pastedValue : s2kShipToAccountSearch,
    }, true);
  };

  const handleSearchClick = () => {
    setIsModalOpen(true);
    setNameSearch(inputValue);
    // debouncedFetchAccounts(
    //   fetchAccounts, // Pass the function reference, not its execution
    //   300
    // )({
    //   name: inputValue, // Provide all expected arguments
    //   city: "",
    //   s2kCustomer: "",
    //   s2kShipTo: "",
    // });
    fetchAccounts({
      name: inputValue,
      city: "",
      s2kCustomer: "",
      s2kShipTo: "",
    }, true);

  };

  const handleAccountClick = (account: Account) => {
    setInputValue(account.name);
    props.onChange({
      id: account.accountid,
      name: account.name,
      entityType: "account",
    });
    setSelectedRecordId(account.accountid);
    setIsModalOpen(false);
  };

  const handleClearLookup = () => {
    setInputValue(""); // Clear the input field // Clear the lookup value in the state/context
    setSelectedRecordId("");
    props.onChange(null);
  };

  const createAccountLink = (recordId: string): string => {
    const globalContext = (window as any).Xrm.Utility.getGlobalContext();
    const clientUrl = globalContext.getClientUrl(); // Base URL of the environment
    const appUrl = globalContext.getCurrentAppUrl(); // Current App's URL
    const appId = new URL(appUrl).searchParams.get("appid"); // Extract App ID

    // Construct and return the full URL to the account record
    return `${clientUrl}/main.aspx?appid=${appId}&pagetype=entityrecord&etn=account&id=${recordId}`;
  };

  const rowHeight = 40; // Height of each row in pixels

  const handleScroll = (event: React.UIEvent<HTMLTableSectionElement>) => {
  const target = event.target as HTMLTableSectionElement;

  // Calculate first and last visible row indices
  const firstVisibleRowIndex = Math.floor(target.scrollTop / rowHeight);
  const lastVisibleRowIndex = Math.floor((target.scrollTop + target.clientHeight) / rowHeight);
  console.log("lastVisiblerowIndex",lastVisibleRowIndex);

  // Trigger API call if the 100th row is visible
  if (accounts.length > 0 && lastVisibleRowIndex >= accounts.length - 5 && loading == false && hasMore) {

    setLoading(true); // Show skeleton rows
    fetchAccounts({
      name : nameSearch,
      city : citySearch,
      s2kCustomer : s2kCustomerAccountSearch,
      s2kShipTo : s2kShipToAccountSearch,
    }, false); // Fetch next 100 records

  }
  };



  const throttledHandleScroll = _.throttle(handleScroll, 200);
  
  return React.createElement(
    "div",
    null,
    React.createElement(
      "div",
      { className: "input-container" },
      React.createElement("input", {
        type: "text",
        className: "main-lookup-input",
        value: inputValue,
        readOnly: props.disabled,
        onPaste : (e) => handleInputPaste(e, "name"),
        onChange: (e) => handleInputChange(e, "name"),
        onClick: () => {
          if (selectedRecordId) {
            const accountLink = createAccountLink(selectedRecordId); // Dynamically generate the account record URL
            window.open(accountLink, "_blank"); // Navigate to the account record in a new tab
          }
        },
      }),
      // Clear button (cross icon)
      inputValue
        ? React.createElement(
            "button",
            {
              className: "lookup-clear-button",
              onClick: () => {
                setInputValue(""); // Clear the input value
                handleClearLookup(); // Custom logic to clear selection in the PCF context
              },
              disabled: props.disabled,
            },
            "✖" // Cross icon
          )
        : null,
      React.createElement(
        "button",
        {
          className: "search-button",
          onClick: handleSearchClick,
          disabled: props.disabled,
        },
        React.createElement("i", { className: "search-icon" }, "🔍")
      )
    ),
    React.createElement(
      Modal,
      {
        isOpen: isModalOpen,
        onRequestClose: () => setIsModalOpen(false),
        contentLabel: "Available Accounts",
        className: "account-lookup-modal",
        overlayClassName: "modal-overlay",
      },
      React.createElement(
        "div",
        { className: "modal-header" },
        React.createElement(
          "h2",
          { className: "modal-title" },
          "Account Lookup Results"
        ),
        React.createElement(
          "button",
          { className: "close-button", onClick: () => setIsModalOpen(false) },
          "✖"
        )
      ),
      React.createElement(
        "div",
        { className: "modal-search searchBarContainer" },
        React.createElement("input", {
          type: "text",
          className: "lookup-input",
          placeholder: "Account Name",
          value: nameSearch,
          onPaste : (e) => handleInputPaste(e, "name"),
          onChange: (e) => handleInputChange(e, "name"),
        }),
        React.createElement("input", {
          type: "text",
          className: "lookup-input",
          placeholder: "S2K Customer Acct ...",
          value: s2kCustomerAccountSearch,
          onPaste : (e) => handleInputPaste(e, "s2kCustomer"),
          onChange: (e) => handleInputChange(e, "s2kCustomer"),
        }),
        React.createElement("input", {
          type: "text",
          className: "lookup-input",
          placeholder: "S2K Ship-to Acct ...",
          value: s2kShipToAccountSearch,
          onPaste : (e) => handleInputPaste(e, "s2kShipTo"),
          onChange: (e) => handleInputChange(e, "s2kShipTo"),
        }),
        React.createElement(
          "button",
          {
            className: "Clear-btn",
            onClick: () => {
              setNameSearch("");
              setCitySearch("");
              setS2kCustomerAccountSearch("");
              setS2kShipToAccountSearch("");

              // Reset table state
              setAccounts([]); // Clear the current table data
              setNextLink(null); // Reset pagination
              setHasMore(true); // Allow further loading
              setLoading(true); // Show loading state while fetching
              
              fetchAccounts({
                name: "",
                city: "",
                s2kCustomer: "",
                s2kShipTo: "",
              }, false);
            },
          },
          "Clear"
        )
      ),
      React.createElement(
        "div",
        { className: "table-container"}, // Apply container class
        React.createElement(
          "div",
          null,
          React.createElement(
            "table",
            { className: "account-Table" },
            // Render Table Header
            React.createElement(
              "thead",
              { className: "Table-header" ,
                style : {
                  // display: "flex",
                  // alignItems: "center",
                  // justifyContent: "space-between",
                }
              },
              table.getHeaderGroups().map((headerGroup: HeaderGroup<any>) =>
                React.createElement(
                  "tr",
                  { key: headerGroup.id,
                    style : {
                      // display: "flex",
                      // alignItems: "center",
                      // justifyContent: "space-between",
                    }
                  },
                  headerGroup.headers.map((header) =>
                    React.createElement(
                      "th",
                      {
                        key: header.id,
                        onClick: header.column.getToggleSortingHandler(),
                        // className : "th-header",
                        title : header.column.columnDef.header,
                        style : {
                          // maxWidth: "100px",
                          overflow: "hidden",
                          whiteSpace: "nowrap",
                          textOverflow: "ellipsis",
                          color : "white",
                        }
                      },
                      // flexRender(
                      //   header.column.columnDef.header,
                      //   header.getContext()
                      // ),
                      // header.column.getIsSorted() === "asc"
                      //   ? " 🔼"
                      //   : header.column.getIsSorted() === "desc"
                      //   ? " 🔽"
                      //   : null
                      React.createElement("div", {
                        style : {
                          display : "flex",
                          alignItems : "center",
                        }
                      },
                      React.createElement(
                        "div",
                        {
                            style: {
                                flexGrow: 1, // Allows text to shrink inside container
                                overflow: "hidden",
                                whiteSpace: "nowrap",
                                textOverflow: "ellipsis",
                                // maxWidth : "120px",
                                fontSize : "13px"
                            }
                        },
                        flexRender(header.column.columnDef.header, header.getContext())
                    ),
                    React.createElement(
                        "div",
                        { style: { flexShrink: 0, marginLeft: "5px" } }, // Ensures the icon never hides
                        header.column.getIsSorted() === "asc" ? " 🔼" : header.column.getIsSorted() === "desc" ? " 🔽" : null
                    ))
                    )
                  )
                )
              )
            ),
           
            // Render Table Body
            // React.createElement(
            //   'tbody',
            //   { className: 'div-tbody-container tbody-scroll' },
            //   table.getRowModel().rows.map((row: Row<Account>) =>
            //     React.createElement(
            //       'tr',
            //       {
            //         key: row.id,
            //         onClick: () => handleAccountClick(row.original),
            //       },
            //       row.getVisibleCells().map((cell: Cell<any, unknown>) =>
            //         React.createElement(
            //           'td',
            //           { key: cell.id },
            //           flexRender(cell.column.columnDef.cell, cell.getContext())
            //         )
            //       )
            //     )
            //   )
            // )
            //   React.createElement(
            //     'tbody',
            //     { className: 'div-tbody-container tbody-scroll' },
            //     loading
            //         ? React.createElement(
            //               'tr',
            //               { key: 'loading-row' },
            //               React.createElement(
            //                   'td',
            //                   { colSpan: table.getAllColumns().length, style: { textAlign: 'center' } },
            //                   'Loading...'
            //               )
            //           )
            //         : table.getRowModel().rows.map((row: Row<Account>) =>
            //               React.createElement(
            //                   'tr',
            //                   {
            //                       key: row.id,
            //                       onClick: () => handleAccountClick(row.original),
            //                       className: selectedRecordId === row.original.accountid ? 'highlighted-row' : '', // Apply the highlighted class
            //                   },
            //                   row.getVisibleCells().map((cell: Cell<any, unknown>) =>
            //                       React.createElement(
            //                           'td',
            //                           { key: cell.id },
            //                           flexRender(cell.column.columnDef.cell, cell.getContext())
            //                       )
            //                   )
            //               )
            //           )
            // )
            React.createElement(
              'tbody',
              {
                className: 'div-tbody-container tbody-scroll',
                onScroll: throttledHandleScroll, // Attach the scroll handler
              },
              [
                // Render actual table rows (existing records)
                ...table.getRowModel().rows.map((row: Row<Account>) =>
                  React.createElement(
                    'tr',
                    {
                      key: row.id,
                      onClick: () => handleAccountClick(row.original),
                      className: selectedRecordId === row.original.accountid ? 'highlighted-row' : '', // Apply the highlighted class
                    },
                    row.getVisibleCells().map((cell: Cell<any, unknown>) =>
                      React.createElement(
                        'td',
                        { key: cell.id },
                        flexRender(cell.column.columnDef.cell, cell.getContext())
                      )
                    )
                  )
                ),
            
                // Render skeleton rows at the bottom if loading next batch
                loading &&
                  Array.from({ length: 5 }).map((_, index) =>
                    React.createElement(SkeletonRow, {
                      key: `skeleton-${index}`,
                      columns: table.getAllColumns().length,
                    })
                  ),
            
                // Handle empty table case when no records are present
                accounts.length === 0 &&
                  React.createElement(
                    'tr',
                    { key: 'no-records-row' },
                    React.createElement(
                      'td',
                      { colSpan: table.getAllColumns().length, style: { textAlign: 'center' } },
                      nameSearch || citySearch || s2kCustomerAccountSearch || s2kShipToAccountSearch
                        ? 'No records found for the current search criteria.'
                        : 'No records available.'
                    )
                  ),
              ]
            )
          )
        ),
        // Create New Account Button (kept)
        React.createElement(
          "div",
          { className: "pagination-controls" },
          React.createElement(
            "div",
            null,
            React.createElement(
              "button",
              {
                className: "create-contact-button",
                onClick: () => {
                  const globalContext = (
                    window as any
                  ).Xrm.Utility.getGlobalContext();
                  const appUrl = globalContext.getCurrentAppUrl();

                  // Extract the App ID from the URL
                  const appId = new URL(appUrl).searchParams.get("appid");

                  const clientUrl = (
                    window as any
                  ).Xrm.Utility.getGlobalContext().getClientUrl();

                  // Construct the account form URL dynamically
                  const accountFormUrl = `${clientUrl}/main.aspx?appid=${appId}&pagetype=entityrecord&etn=account`;

                  // Redirect to the account creation form
                  window.open(accountFormUrl, "_blank"); // Opens the form in a new tab
                },
              },
              "New Account"
            )
          )
        )
      )
      // old table with pagination
      // React.createElement(
      //   'div',
      //   { className: 'table-container'},// Apply container class
      //   React.createElement(
      //     'div',
      //     null,
      //     React.createElement(
      //       'table',
      //       { className: 'account-Table'},
      //       // Render Table Header
      //       React.createElement(
      //         'thead',
      //         {className : "Table-header"},
      //         table.getHeaderGroups().map((headerGroup: HeaderGroup<any>) =>
      //           React.createElement(
      //             'tr',
      //             { key: headerGroup.id },
      //             headerGroup.headers.map((header) =>
      //               React.createElement(
      //                 'th',
      //                 {
      //                   key: header.id,
      //                   onClick: header.column.getToggleSortingHandler(),
      //                 },
      //                 flexRender(
      //                   header.column.columnDef.header,
      //                   header.getContext()
      //                 ),
      //                 header.column.getIsSorted() === 'asc'
      //                   ? ' 🔼'
      //                   : header.column.getIsSorted() === 'desc'
      //                   ? ' 🔽'
      //                   : null
      //               )
      //             )
      //           )
      //         )
      //       ),
      //       // Render Table Body
      //       React.createElement(
      //         'tbody',
      //         { className: 'div-tbody-container tbody-scroll' },
      //         table.getRowModel().rows.map((row: Row<Account>) =>
      //           React.createElement(
      //             'tr',
      //             {  key: row.id,
      //                 onClick: () => handleAccountClick(row.original),
      //             },
      //             row.getVisibleCells().map((cell: Cell<any, unknown>) =>
      //               React.createElement(
      //                 'td',
      //                 { key: cell.id },
      //                 flexRender(cell.column.columnDef.cell, cell.getContext())
      //               )
      //             )
      //           )
      //         )
      //       )
      //     )
      //   ),
      //   // Pagination Controls
      //   React.createElement(
      //     'div',
      //     { className: 'pagination-controls' },
      //     React.createElement(
      //       "div",
      //       { className: "pagination-controls " },
      //       React.createElement(
      //         'div',
      //         null,
      //         React.createElement(
      //           "div", null,
      //           // { className: "create-new-contact" },
      //           React.createElement(
      //             "button",
      //             {
      //               className: "create-contact-button",
      //               onClick: () => {

      //                 const globalContext = (window as any).Xrm.Utility.getGlobalContext();
      //                 const appUrl = globalContext.getCurrentAppUrl();

      //                 // Extract the App ID from the URL
      //                 const appId = new URL(appUrl).searchParams.get("appid");

      //                 const clientUrl = (
      //                   window as any
      //                 ).Xrm.Utility.getGlobalContext().getClientUrl();

      //                 // Construct the account form URL dynamically
      //                 const accountFormUrl = `${clientUrl}/main.aspx?appid=${appId}&pagetype=entityrecord&etn=account`;

      //                 // Redirect to the account creation form
      //                 window.open(accountFormUrl, "_blank"); // Opens the form in a new tab
      //               },
      //             },
      //             "Create New Account"
      //           )
      //         ),
      //       ),
      //       // React.createElement(
      //       //   'div',
      //       //   {className : "pagination-div"},
      //       //   React.createElement(
      //       //     "button",
      //       //     {
      //       //       className: "pagination-button",
      //       //       onClick: handlePreviousPage,
      //       //       disabled: page === 1,
      //       //     },
      //       //     "Previous"
      //       //   ),
      //       //   React.createElement(
      //       //     "span",
      //       //     null,
      //       //     `Page ${page} of ${Math.ceil(accounts.length / pageSize)}`
      //       //   ),
      //       //   React.createElement(
      //       //     "button",
      //       //     {
      //       //       className: "pagination-button",
      //       //       onClick: handleNextPage,
      //       //       disabled: endIndex >= accounts.length,
      //       //     },
      //       //     "Next"
      //       //   ),
      //       // )
      //     ),
      //     // React.createElement(
      //     //   'button',
      //     //   {
      //     //     onClick: () => table.setPageIndex(0),
      //     //     disabled: !table.getCanPreviousPage(),
      //     //   },
      //     //   '<<'
      //     // ),
      //     // React.createElement(
      //     //   'button',
      //     //   {
      //     //     onClick: () => table.previousPage(),
      //     //     disabled: !table.getCanPreviousPage(),
      //     //   },
      //     //   '<'
      //     // ),
      //     // React.createElement(
      //     //   'span',
      //     //   null,
      //     //   `Page `,
      //     //   React.createElement(
      //     //     'strong',
      //     //     null,
      //     //     `${table.getState().pagination.pageIndex + 1} of ${table.getPageCount()}`
      //     //   )
      //     // ),
      //     // React.createElement(
      //     //   'button',
      //     //   {
      //     //     onClick: () => table.nextPage(),
      //     //     disabled: !table.getCanNextPage(),
      //     //   },
      //     //   '>'
      //     // ),
      //     // React.createElement(
      //     //   'button',
      //     //   {
      //     //     onClick: () => table.setPageIndex(table.getPageCount() - 1),
      //     //     disabled: !table.getCanNextPage(),
      //     //   },
      //     //   '>>'
      //     // )
      //   ),

      // ),

      // first deployed table state working
      // React.createElement(
      //   "table",
      //   { className: "account-table" },
      //   React.createElement(
      //     "thead",
      //     null,
      //     React.createElement(
      //       "tr",
      //       null,
      //       React.createElement("th", null,
      //         // { style: { width: "20%" } },/
      //          "Name"),
      //       React.createElement("th", null,
      //         // { style: { width: "20%" } },
      //          "City"),
      //       React.createElement(
      //         "th", null,
      //         // { style: { width: "20%" } },
      //         "S2K Customer"
      //       ),
      //       React.createElement(
      //         "th", null,
      //         // { style: { width: "20%" } },
      //         "S2K Ship-to"
      //       )
      //     )
      //   ),
      //   React.createElement(
      //     "tbody",
      //     { className: "div-tbody-container" },
      //     loading
      //       ? React.createElement(
      //           "tr",
      //           null,
      //           React.createElement(
      //             "td",
      //             { colSpan: 4, className: "centered-text" },
      //             "Loading Accounts...!"
      //           )
      //         )
      //       : accounts.length > 0
      //       ? accounts.map((account) =>
      //           React.createElement(
      //             "tr",
      //             {
      //               key: account.accountid,
      //               onClick: () => handleAccountClick(account),
      //             },
      //             React.createElement(
      //               "td",  null,
      //               // { style: { width: "15%" } },
      //               account.name
      //             ),
      //             React.createElement(
      //               "td",  null,
      //               // { style: { width: "15%" } },
      //               account.address1_city
      //             ),
      //             React.createElement(
      //               "td",  null,
      //               // { style: { width: "15%" } },
      //               account.amc01_erp_s2kcustomeracct
      //             ),
      //             React.createElement(
      //               "td",  null,
      //               // { style: { width: "15%" } },
      //               account.amc01_erp_s2kshiptoacct
      //             )
      //           )
      //         )
      //       : React.createElement(
      //           "tr",
      //           null,
      //           React.createElement(
      //             "td",
      //             { colSpan: 4, },
      //             React.createElement(
      //               "p",
      //             {className: "centered-text" },
      //             "No Records Found"
      //             )
      //           )
      //         )
      //   )
      // ),
    )
  );
};

const SkeletonRow = ({ columns }: { columns: number }) =>
  React.createElement(
    "tr",
    { key: "skeleton-row", className: "skeleton-row" },
    Array.from({ length: columns }).map((_, index) =>
      React.createElement(
        "td",
        { key: `skeleton-cell-${index}` },
        React.createElement("div", { className: "skeleton-loader" })
      )
    )
);

export default AccountLookupModal;


// latest running code
//   return React.createElement(
//     "div",
//     null,
//     React.createElement(
//       "div",
//       { className: "input-container" },
//       React.createElement("input", {
//         type: "text",
//         className: "lookup-input",
//         value: inputValue,
//         onChange: handleInputChange,
//         // ref: inputRef,
//       }),
//       React.createElement(
//         "button",
//         { className: "search-button", onClick: handleSearchClick },
//         React.createElement("i", { className: "search-icon" }, "🔍")
//       )
//     ),
//     React.createElement(
//       Modal,
//       {
//         isOpen: isModalOpen,
//         onRequestClose: () => setIsModalOpen(false),
//         contentLabel: "Available Accounts",
//         className : "account-lookup-modal",
//         overlayClassName: "modal-overlay",
//       },
//       React.createElement(
//         "div",
//         { className: "modal-header" },
//         React.createElement(
//           "h2",
//           { className: "modal-title" },
//           "Account Lookup Results"
//         ),
//         React.createElement(
//           "button",
//           { className: "close-button", onClick: () => setIsModalOpen(false) },
//           "✖"
//         )
//       ),
//       React.createElement(
//         "div",
//         { className: "modal-search searchBarContainer" },
//         React.createElement("input", {
//           type: "text",
//           className: "lookup-input",
//           placeholder: "Name ...",
//           value: nameSearch,
//           onChange: handleNameChange,
//         }),
//         // React.createElement("input", {
//         //   type: "text",
//         //   className: "lookup-input",
//         //   placeholder: "City...",
//         //   value: citySearch,
//         //   onChange: handleCityChange,
//         // }),
//         React.createElement("input", {
//           type: "text",
//           className: "lookup-input",
//           placeholder: "S2K Customer Acct ...",
//           value: s2kCustomerAccountSearch,
//           onChange: handleS2kCustomerAccountChange,
//         }),
//         React.createElement("input", {
//           type: "text",
//           className: "lookup-input",
//           placeholder: "S2K Ship-to Acct ...",
//           value: s2kShipToAccountSearch,
//           onChange: handleS2kShipToAccountChange,
//         }),
//         React.createElement(
//           "button",
//           {
//             className: "Clear_btn",
//             onClick: () => {
//               setNameSearch("");
//               setCitySearch("");
//               setS2kCustomerAccountSearch("");
//               setS2kShipToAccountSearch("");
//               fetchAccounts("", "", "", "");
//             },
//           },
//           "Clear"
//         )
//       ),
//       React.createElement(
//         "table",
//         { className: "account-table" },
//         React.createElement(
//           "thead",
//           null,
//           React.createElement(
//             "tr",
//             null,
//             // React.createElement("th", null, "ID"),
//             React.createElement("th", { style: { width: '18%' } }, "Name"),
//             React.createElement("th", { style: { width: '18%' } }, "City"),
//             React.createElement("th", { style: { width: '15%' } }, "S2K Customer"),
//             React.createElement("th", { style: { width: '15%' } }, "S2K Ship-to"),
//           )
//         ),
//         React.createElement(
//           "tbody",
//           null,
//             loading ? (
//               React.createElement("tr", null,
//                 React.createElement("td", { colSpan: 4, className: "centered-text" }, "Loading Accounts...!")
//               )
//             ) : accounts.length > 0 ? (
//               accounts.map((account) => (
//                 React.createElement(
//                   "tr",
//                   {
//                     key: account.accountid,
//                     onClick: () => handleAccountClick(account),
//                   },
//                   React.createElement("td", { style: { width: '18%' } }, account.name),
//                   React.createElement("td", { style: { width: '18%' } }, account.address1_city),
//                   React.createElement("td", { style: { width: '15%' } }, account.amc01_erp_s2kcustomeracct),
//                   React.createElement("td", { style: { width: '15%' } }, account.amc01_erp_s2kshiptoacct),
//                 )
//               ))
//             ) : (
//               React.createElement("tr", null,
//                 React.createElement("td", { colSpan: 4 , className: "centered-text" }, "No records found")
//               )
//             )
//           )
//     )
//   )
// )

// old code
// interface AccountLookupModalProps {
//   context: ComponentFramework.Context<IInputs>;
//   notifyOutputChanged: () => void;
//   value: string;
//   onChange: (newValue: string) => void;
// }

// interface Account {
//   name : string;
//   accountid : string;
// }

// const AccountLookupModal = (props: AccountLookupModalProps) => {

//   const [inputValue, setInputValue] = useState<string>(props.value);
//   const [accounts, setAccounts] = useState<Account[]>([]);
//   const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
//   const inputRef = useRef<HTMLInputElement>(null);
//   const [modalSearchValue, setModalSearchValue] = useState<string>('');

//   useEffect(() => {
//     setInputValue(props.value);
//   }, [props.value]);

//   const fetchAccounts = (name: string) => {
//     console.log("inside fetch accounts func");
//     // const clientUrl = "https://orgde4a23c7.crm8.dynamics.com/";

//     const clientUrl = window.Xrm.Utility.getGlobalContext().getClientUrl();
//     const filter = name ? `&$filter=contains(name,'${name}')` : '';

//     const req = new XMLHttpRequest();
//     req.open(
//         "GET",
//         `${clientUrl}/api/data/v9.2/accounts?$select=name,accountid${filter}`,
//         true
//     );
//     req.setRequestHeader("OData-MaxVersion", "4.0");
//     req.setRequestHeader("OData-Version", "4.0");
//     req.setRequestHeader("Content-Type", "application/json; charset=utf-8");
//     req.setRequestHeader("Accept", "application/json");
//     req.setRequestHeader("Prefer", "odata.include-annotations=*");
//     req.onreadystatechange = function () {
//       if (this.readyState === 4) {
//         req.onreadystatechange = null;
//         if (req.readyState === 4 && this.status === 200) {
//           const response = JSON.parse(req.response);
//           console.log(response.value);
//           setAccounts(response.value);
//           setIsModalOpen(true);
//         }
//       } else {
//         console.log(this.responseText);
//       }
//     };
//     req.send();
//   };

//   const debouncedFetchAccounts = debounce((name: string) => {
//     fetchAccounts(name);
//     console.log("Inside debounce");
//   }, 300); // Set the debounce delay to 300ms

//   const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
//     const newValue = e.target.value;
//     setInputValue(newValue);
//     props.onChange(newValue);
//     // debouncedFetchAccounts(newValue); // Use debounced function
//   };

//   const handleSearchClick = () => {
//     fetchAccounts(inputValue);
//     setIsModalOpen(true);
//   };

//   const handleAccountClick = (account: Account) => {
//     setInputValue(account.name);
//     props.onChange(account.name);
//     setIsModalOpen(false);
//   };

//   const handleModalSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
//     const newValue = e.target.value;
//     setModalSearchValue(newValue);
//     props.onChange(newValue);
//     debouncedFetchAccounts(newValue);
//   };

//   return React.createElement(
//     "div",
//     null,
//     React.createElement(
//       "div",
//       { className: "input-container" },
//       React.createElement("input", {
//         type: "text",
//         className: "lookup-input",
//         value: inputValue,
//         onChange: handleInputChange,
//         // ref: inputRef,
//       }),
//       React.createElement(
//         "button",
//         { className: "search-button", onClick: handleSearchClick },
//         React.createElement("i", { className: "search-icon" }, "🔍")
//       )
//     ),
//     React.createElement(
//       Modal,
//       {
//         isOpen: isModalOpen,
//         onRequestClose: () => setIsModalOpen(false),
//         contentLabel: "Available Accounts",
//       },
//       React.createElement(
//         "div",
//         { className: "modal-header" },
//         React.createElement("h2", { className: "modal-title" }, "Account Lookup Results"),
//         React.createElement(
//             "button",
//             { className: "close-button", onClick: () => setIsModalOpen(false) },
//             "✖"
//         )
//        ),
//        React.createElement("div", { className: "modal-search" },
//         React.createElement("input", {
//             type: "text",
//             className: "lookup-input",
//             placeholder: "Search...",
//             value: modalSearchValue,
//             onChange: handleModalSearchChange
//         })
//       ),
//       React.createElement(
//         "table",
//         { className: "account-table" },
//         React.createElement(
//           "thead",
//           null,
//           React.createElement(
//             "tr",
//             null,
//             // React.createElement("th", null, "ID"),
//             React.createElement("th", null, "Name"),
//             // React.createElement("th", null, "Email"),
//             // React.createElement("th", null, "Phone")
//           )
//         ),
//         React.createElement(
//           "tbody",
//           null,
//           accounts.map((account) =>
//             React.createElement(
//               "tr",
//               { key: account.accountid, onClick: () => handleAccountClick(account)},
//               // React.createElement("td", null, account.accountid),
//               React.createElement("td", null, account.name),
//               // React.createElement("td", null, account.emailaddress1),
//               // React.createElement("td", null, account.ksw_phone)
//             )
//           )
//         )
//       ),
//     )
//   );
// };

// export default AccountLookupModal;


