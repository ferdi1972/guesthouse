import * as XLSX from 'xlsx';
import { db } from '../firebase';
import { collection, getDocs } from 'firebase/firestore';
import { handleFirestoreError, OperationType } from '../lib/firestore-utils';

export const exportToExcel = async () => {
  try {
    const collections = ['rooms', 'guests', 'bookings', 'cashbook', 'staff', 'receipts', 'electricity', 'roomInventory', 'budgets'];
    const workbook = XLSX.utils.book_new();

    for (const colName of collections) {
      const querySnapshot = await getDocs(collection(db, colName));
      const data = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));

      if (data.length > 0) {
        // Flatten nested objects if necessary (e.g., items in receipts)
        const flattenedData = data.map(item => {
          const flatItem: any = { ...item };
          // Convert complex objects to strings for Excel
          Object.keys(flatItem).forEach(key => {
            if (typeof flatItem[key] === 'object' && flatItem[key] !== null) {
              flatItem[key] = JSON.stringify(flatItem[key]);
            }
          });
          return flatItem;
        });

        const worksheet = XLSX.utils.json_to_sheet(flattenedData);
        XLSX.utils.book_append_sheet(workbook, worksheet, colName.charAt(0).toUpperCase() + colName.slice(1));
      }
    }

    const now = new Date();
    const dateStr = now.toISOString().split('T')[0];
    XLSX.writeFile(workbook, `guesthouse-data-export-${dateStr}.xlsx`);
    
    return true;
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, 'multiple-collections');
    throw error;
  }
};

export const exportDataToExcel = (data: any[], fileName: string, sheetName: string) => {
  try {
    const workbook = XLSX.utils.book_new();
    const worksheet = XLSX.utils.json_to_sheet(data);
    XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);
    XLSX.writeFile(workbook, `${fileName}.xlsx`);
    return true;
  } catch (error) {
    console.error('Error exporting data to Excel:', error);
    throw error;
  }
};

export const exportMultipleSheetsToExcel = (sheets: { [sheetName: string]: any[] }, fileName: string) => {
  try {
    const workbook = XLSX.utils.book_new();
    Object.entries(sheets).forEach(([sheetName, data]) => {
      if (data.length > 0) {
        const worksheet = XLSX.utils.json_to_sheet(data);
        XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);
      }
    });
    XLSX.writeFile(workbook, `${fileName}.xlsx`);
    return true;
  } catch (error) {
    console.error('Error exporting multiple sheets to Excel:', error);
    throw error;
  }
};
