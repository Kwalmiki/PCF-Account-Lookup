import * as React from "react";
import * as ReactDOM from "react-dom";
import CustomFramework, { IInputs, IOutputs } from "./generated/CustomTypes";
import AccountLookupModal from "./src/AccountLookupModal"; 
// import "./css/AccountLookupModal.css"

export class PcfDistributorLookupNew implements ComponentFramework.StandardControl<IInputs, IOutputs> {
   
   private _notifyOutputChanged: () => void;
   private _container: HTMLDivElement;
   private _context: ComponentFramework.Context<IInputs>;
   private _lookupValue: CustomFramework.EntityReference | null;
   private _filterCriteria: string | undefined;
   private _disabled : boolean | undefined;
   private _entityName : string | undefined;

   constructor() {
       this._lookupValue = null;
       this._disabled = false;
   }

   public async init(
       context: ComponentFramework.Context<IInputs>,
       notifyOutputChanged: () => void,
       state: ComponentFramework.Dictionary,
       container: HTMLDivElement
   ) {
       this._context = context;
       this._notifyOutputChanged = notifyOutputChanged;
       this._container = container;

        // Retrieve and use the entity ID
        const entityId = this.getCurrentEntityId();
        console.log("Entity ID:", entityId);
        this._entityName = context.parameters.Entity.raw;

        if(entityId && this._entityName != undefined && this._entityName != "") 
            this.retrieveRecord(this._entityName, entityId, "?$select=statecode");

       // Store filter criteria from parameters
       this._filterCriteria = context.parameters.filterCriteria.raw; 
       await this.loadLookupData(context);
       this.renderControl();
   }

     // Retrieve the current entity ID using Xrm
     private getCurrentEntityId(): string | null {
        if ((window as any).Xrm) {
            const entityId = (window as any).Xrm.Page.data.entity.getId();
            return entityId ? entityId.replace("{", "").replace("}", "") : null; // Remove curly braces if present
        } else {
            console.warn("Xrm is not available in this context.");
            return null;
        }
    }

    public retrieveRecord(entityName : string, entityId : string, selectFields : string) {

        const clientUrl = (
            window as any
          ).Xrm.Utility.getGlobalContext().getClientUrl();

            const url = `${clientUrl}/api/data/v9.2/${entityName}(${entityId})${selectFields}`;
        
            const xhr = new XMLHttpRequest();
            xhr.open("GET", url, true);
            xhr.setRequestHeader("OData-MaxVersion", "4.0");
            xhr.setRequestHeader("OData-Version", "4.0");
            xhr.setRequestHeader("Content-Type", "application/json; charset=utf-8");
            xhr.setRequestHeader("Accept", "application/json");
            xhr.setRequestHeader("Prefer", "odata.include-annotations=*");
            xhr.onload = () => {
                if (xhr.status === 200) {
                    const record = JSON.parse(xhr.responseText);
                    if (record.statecode === 1 || record.statecode === 2 || record.statecode === 3) { // Assuming '1' represents "Active"
                        this._disabled = true; // Lock the field
                        console.log("Field locked (quote is active).");
                    } else {
                        this._disabled = false; // Unlock the field
                        console.log("Field unlocked (quote is not active).");
                    }
                } else {
                    console.error("Error retrieving record. HTTP Status:", xhr.status, xhr.statusText);
                    this._disabled = false; // Default to unlocked on error
                }
                this.renderControl();
            };
        
            xhr.onerror =  () => {
                console.error("Network error while retrieving the record.");
                this._disabled = false; // Default to unlocked on error
                this.renderControl();
            };
        
            xhr.send();
    }

   public async updateView(context: ComponentFramework.Context<IInputs>): Promise<void> {
       this._context = context;
       const newFilterCriteria = context.parameters.filterCriteria.raw;

       // Re-fetch data if filter criteria changes
       if (newFilterCriteria !== this._filterCriteria) {
           this._filterCriteria = newFilterCriteria;
           await this.loadLookupData(context);
       }

       await this.loadLookupData(context);
       this.renderControl();
   }

   private async loadLookupData(context: ComponentFramework.Context<IInputs>) {
       const lookupRaw = context.parameters.lookupField.raw;
       if (lookupRaw && lookupRaw.length > 0) {
           const lookupId = lookupRaw[0]?.id;
           const lookupName = lookupRaw[0]?.name;
           if (lookupId && !lookupName) {
               try {
                   // Fetch account name from Dataverse if it's missing
                   const account = await context.webAPI.retrieveRecord("account", lookupId, "?$select=name");
                   this._lookupValue = { id: lookupId, name: account.name, entityType: "account" };

               } catch (error) {
                   console.error("Error fetching account name:", error);
               }
           } else {
               this._lookupValue = lookupRaw[0];
           }
       } else {
           this._lookupValue = null;
       }
   }

   public getOutputs(): IOutputs {
       return {
           lookupField: this._lookupValue ? [this._lookupValue] : undefined
       };
   }

   public destroy(): void {
       ReactDOM.unmountComponentAtNode(this._container);
   }

   private handleLookupChange = (newValue: CustomFramework.EntityReference) => {
       this._lookupValue = newValue;
       this._notifyOutputChanged();
       this.renderControl();
   };

   private renderControl(): void {
       ReactDOM.render(
           React.createElement(AccountLookupModal, {
               context: this._context,
               notifyOutputChanged: this._notifyOutputChanged,
               value: this._lookupValue ? this._lookupValue : null,
               onChange: this.handleLookupChange,
               filterCriteria : this._filterCriteria ? this._filterCriteria : undefined,  
               disabled : this._disabled,
           }),
           this._container
       );
   }

}











































































































































// export class pcfAccLookup implements ComponentFramework.StandardControl<IInputs, IOutputs> {
//     private _notifyOutputChanged: () => void;
//     private _container: HTMLDivElement;
//     private _context: ComponentFramework.Context<IInputs>;
//     private _lookupValue:  CustomFramework.EntityReference | null;
  
//     constructor() {
//         this._lookupValue = null;
//     }
  
//     public init(context: ComponentFramework.Context<IInputs>, notifyOutputChanged: () => void, state: ComponentFramework.Dictionary, container: HTMLDivElement) {
//         this._context = context;
//         this._notifyOutputChanged = notifyOutputChanged;
//         this._container = container;
  
//         this.renderControl();
//     }
  
//     public updateView(context: ComponentFramework.Context<IInputs>): void {
//         this._context = context;
//         this._lookupValue = context.parameters.lookupField.raw ? context.parameters.lookupField.raw[0] : null;
//         console.log("Lookup value : ", this._lookupValue);
//         this.renderControl();
//     }
  
//     public getOutputs(): IOutputs {
//         return {
//             lookupField: this._lookupValue ? [this._lookupValue] : undefined
//         };
//     }
  
//     public destroy(): void {
//         ReactDOM.unmountComponentAtNode(this._container);
//     }
  
//     private handleLookupChange = (newValue: CustomFramework.EntityReference) => {
//         this._lookupValue = newValue;
//         this._notifyOutputChanged();
//         this.renderControl();
//     };
  
//     private renderControl(): void {
//         ReactDOM.render(
//             React.createElement(AccountLookupModal, {
//                 context: this._context,
//                 notifyOutputChanged: this._notifyOutputChanged,
//                 value: this._lookupValue ? this._lookupValue?.name : "",
//                 onChange: this.handleLookupChange
//             }),
//             this._container
//           );
//       }
    
// }
// export class AccLookup implements ComponentFramework.StandardControl<IInputs, IOutputs> {
//     private _notifyOutputChanged: () => void;
//     private _container: HTMLDivElement;
//     private _context: ComponentFramework.Context<IInputs>;
//     private _value: string;

//     constructor() {
//         this._value = "";
//     }

//     public init(context: ComponentFramework.Context<IInputs>, notifyOutputChanged: () => void, state: ComponentFramework.Dictionary, container: HTMLDivElement) {
//         this._context = context;
//         this._notifyOutputChanged = notifyOutputChanged;
//         this._container = container;

//         this.renderControl();
//     }

//     public updateView(context: ComponentFramework.Context<IInputs>): void {
//         this._value = context.parameters.accountName.raw || "";
//         this.renderControl();
//     }

//     public getOutputs(): IOutputs {
//         return {
//             accountName: this._value
//         };
//     }

//     public destroy(): void {
//         ReactDOM.unmountComponentAtNode(this._container);
//     }

//     private renderControl(): void {
//         ReactDOM.render(
//             React.createElement(AccountLookupModal, {
//                 context: this._context,
//                 notifyOutputChanged: this._notifyOutputChanged,
//                 value: this._value,
//                 onChange: (newValue: string) => {
//                     this._value = newValue;
//                     this._notifyOutputChanged();
//                 }
//             }),
//             this._container
//         );
//     }
// }
