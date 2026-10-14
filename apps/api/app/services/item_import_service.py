import io
import re
import csv
import secrets
import logging
from datetime import datetime, timezone
from typing import Optional, List, Dict, Any, Tuple
from bson import ObjectId
from fastapi import UploadFile, HTTPException, status
from app.core.security import TokenPayload, resolve_user_name
from app.core.database import get_database

logger = logging.getLogger("quickbill.import")

# Standard Column Headers for Template
TEMPLATE_HEADERS = [
    "Product Name",
    "Category",
    "Barcode",
    "SKU",
    "Sale Price",
    "MRP",
    "Purchase Price",
    "Tax Rate %",
    "Opening Stock",
    "Min Stock Alert",
    "Unit",
    "Branch Code / Name",
    "Description",
]

# Header synonym mapping
HEADER_SYNONYMS = {
    "name": [
        "product name", "product_name", "productname", "name",
        "item name", "item_name", "itemname", "title"
    ],
    "category": [
        "category", "category name", "category_name", "item category", "item_category"
    ],
    "barcode": [
        "barcode", "bar code", "bar_code", "ean", "upc", "qr", "code"
    ],
    "sku": [
        "sku", "item code", "item_code", "product code", "product_code"
    ],
    "sale_price": [
        "sale price", "sale_price", "saleprice", "selling price",
        "selling_price", "price", "rate", "retail price", "retail_price"
    ],
    "mrp": [
        "mrp", "maximum retail price", "max retail price", "max_retail_price"
    ],
    "purchase_price": [
        "purchase price", "purchase_price", "purchaseprice", "cost price",
        "cost_price", "cost", "buying price", "purchase cost"
    ],
    "tax_rate": [
        "tax rate %", "tax rate", "tax_rate", "taxrate", "tax %", "tax",
        "gst %", "gst", "gst rate", "gst_rate"
    ],
    "opening_stock": [
        "opening stock", "opening_stock", "openingstock", "stock",
        "current stock", "current_stock", "qty", "quantity", "stock qty"
    ],
    "min_stock_alert": [
        "min stock alert", "min stock", "min_stock", "min_stock_alert",
        "minstockalert", "low stock alert", "reorder level", "alert level"
    ],
    "unit": [
        "unit", "uom", "measurement unit", "unit of measure", "unit_of_measure"
    ],
    "branch": [
        "branch code / name", "branch code", "branch_code", "branch name",
        "branch_name", "branch", "location", "location code", "location_code",
        "outlet", "store"
    ],
    "description": [
        "description", "desc", "notes", "details", "item description"
    ],
}

SAMPLE_ROWS = [
    [
        "Organic Basmati Rice 5kg",
        "Grains & Staples",
        "8901234567891",
        "SKU-GRN-101",
        450.00,
        499.00,
        380.00,
        5.0,
        50.0,
        10.0,
        "kg",
        "",
        "Premium aged long-grain fragrant basmati rice",
    ],
    [
        "Cold Pressed Mustard Oil 1L",
        "Edible Oils",
        "8901234567892",
        "SKU-OIL-202",
        195.00,
        220.00,
        155.00,
        5.0,
        40.0,
        8.0,
        "ltr",
        "",
        "Pure kachi ghani traditional unrefined mustard oil",
    ],
    [
        "Wireless Optical Mouse",
        "Electronics & Gadgets",
        "8901234567893",
        "SKU-ELE-303",
        599.00,
        799.00,
        380.00,
        18.0,
        25.0,
        5.0,
        "pcs",
        "",
        "2.4GHz ergonomically designed USB wireless optical mouse",
    ],
]


def _clean_str(val: Any) -> Optional[str]:
    if val is None:
        return None
    s = str(val).strip()
    return s if s else None


def _clean_num(val: Any, default: float = 0.0) -> float:
    if val is None:
        return default
    if isinstance(val, (int, float)):
        return float(val)
    s = str(val).strip()
    if not s:
        return default
    # Remove currency symbols and commas e.g. ₹450.00, $1,200.50
    cleaned = re.sub(r"[^\d.-]", "", s)
    try:
        return float(cleaned)
    except (ValueError, TypeError):
        return default


def _canonicalize_header(raw_header: str) -> Optional[str]:
    cleaned = raw_header.lower().strip()
    cleaned = re.sub(r"[\*#:\(\)]", "", cleaned).strip()
    for field_key, synonyms in HEADER_SYNONYMS.items():
        if cleaned in synonyms:
            return field_key
    return None


class ItemImportService:
    @staticmethod
    async def generate_template(db, business_id: str, format_type: str = "xlsx") -> Tuple[io.BytesIO, str, str]:
        """
        Generates a standard, user-friendly template in Excel (.xlsx) or CSV format.
        Excel templates include an instructions & branch reference sheet.
        """
        # Fetch tenant branches for reference from primary DB (or tenant DB fallback)
        b_queries = [{"businessId": business_id}]
        if ObjectId.is_valid(business_id):
            b_queries.append({"businessId": ObjectId(business_id)})
        
        locations = []
        try:
            primary_db = get_database()
            cursor = primary_db.locations.find({"$or": b_queries})
            count_p = await primary_db.locations.count_documents({"$or": b_queries})
            if count_p == 0:
                cursor = db.locations.find({"$or": b_queries})
            async for loc in cursor:
                locations.append({
                    "id": str(loc.get("_id")),
                    "code": loc.get("code", ""),
                    "name": loc.get("name", ""),
                    "isDefault": bool(loc.get("isDefault", False)),
                })
        except Exception as e:
            logger.warning(f"Error fetching locations for template: {e}")

        if format_type == "csv":
            buf = io.StringIO()
            writer = csv.writer(buf)
            writer.writerow(TEMPLATE_HEADERS)
            for row in SAMPLE_ROWS:
                writer.writerow(row)
            
            bytes_io = io.BytesIO(buf.getvalue().encode("utf-8-sig"))
            bytes_io.seek(0)
            return bytes_io, "product_import_template.csv", "text/csv; charset=utf-8"

        # Generate Excel (.xlsx)
        import openpyxl
        from openpyxl.styles import Font, PatternFill, Alignment, Border, Side
        from openpyxl.utils import get_column_letter

        wb = openpyxl.Workbook()
        ws_products = wb.active
        ws_products.title = "Products"

        # Styles
        header_font = Font(name="Calibri", size=11, bold=True, color="FFFFFF")
        header_fill = PatternFill(start_color="1E40AF", end_color="1E40AF", fill_type="solid") # Deep Indigo
        center_align = Alignment(horizontal="center", vertical="center", wrap_text=True)
        left_align = Alignment(horizontal="left", vertical="center")
        right_align = Alignment(horizontal="right", vertical="center")
        thin_border = Border(
            left=Side(style="thin", color="D1D5DB"),
            right=Side(style="thin", color="D1D5DB"),
            top=Side(style="thin", color="D1D5DB"),
            bottom=Side(style="thin", color="D1D5DB"),
        )

        # Write Products Header
        for col_idx, header_text in enumerate(TEMPLATE_HEADERS, start=1):
            cell = ws_products.cell(row=1, column=col_idx, value=header_text)
            cell.font = header_font
            cell.fill = header_fill
            cell.alignment = center_align
            cell.border = thin_border

        # Write Sample Rows
        for row_idx, sample in enumerate(SAMPLE_ROWS, start=2):
            for col_idx, val in enumerate(sample, start=1):
                cell = ws_products.cell(row=row_idx, column=col_idx, value=val)
                cell.border = thin_border
                if isinstance(val, (int, float)):
                    cell.alignment = right_align
                    if col_idx in (5, 6, 7): # Prices
                        cell.number_format = "#,##0.00"
                    elif col_idx == 8: # Tax %
                        cell.number_format = "0.0"
                else:
                    cell.alignment = left_align

        # Auto-adjust column widths
        for col in ws_products.columns:
            max_len = 0
            col_letter = get_column_letter(col[0].column)
            for cell in col:
                val_str = str(cell.value or "")
                max_len = max(max_len, len(val_str))
            ws_products.column_dimensions[col_letter].width = max(max_len + 4, 14)

        # Sheet 2: Instructions & Store Branches
        ws_instructions = wb.create_sheet(title="Instructions & Branches")
        title_font = Font(name="Calibri", size=14, bold=True, color="1E3A8A")
        sub_font = Font(name="Calibri", size=11, bold=True, color="374151")
        body_font = Font(name="Calibri", size=10, color="4B5563")

        ws_instructions.cell(row=1, column=1, value="QuickBill Product Import Instructions").font = title_font
        
        guidelines = [
            ("Required Columns", "• 'Product Name' and 'Sale Price' are mandatory for every row."),
            ("Product Matching & Updates", "• If a row has a matching Barcode, SKU, or Product Name in your catalog, its details, prices, and stock will be updated if 'Update Existing' is enabled."),
            ("Automatic Categories", "• If a category does not exist yet in your store catalog, it will be automatically created and assigned to the product."),
            ("Branch Selection", "• If 'Branch Code / Name' is left empty, the branch selected during upload in the modal will be used."),
            ("Pricing & Units", "• Sale Price and MRP should be retail selling prices including or excluding tax based on your billing configuration. Default Unit is 'pcs'."),
            ("Stock Movements", "• Opening Stock values will automatically create an immutable ledger entry in the stock movement ledger for audit compliance."),
        ]

        curr_row = 3
        for title, desc in guidelines:
            ws_instructions.cell(row=curr_row, column=1, value=title).font = sub_font
            ws_instructions.cell(row=curr_row + 1, column=1, value=desc).font = body_font
            curr_row += 3

        # List Tenant Branches
        curr_row += 1
        ws_instructions.cell(row=curr_row, column=1, value="Your Store Branches (Use these Branch Codes in the template):").font = sub_font
        curr_row += 1

        branch_headers = ["Branch Code", "Branch Name", "Default Branch?"]
        for c_idx, bh in enumerate(branch_headers, start=1):
            cell = ws_instructions.cell(row=curr_row, column=c_idx, value=bh)
            cell.font = Font(name="Calibri", size=10, bold=True, color="FFFFFF")
            cell.fill = PatternFill(start_color="3B82F6", end_color="3B82F6", fill_type="solid")
            cell.alignment = center_align

        curr_row += 1
        if locations:
            for loc in locations:
                ws_instructions.cell(row=curr_row, column=1, value=loc.get("code") or "N/A").alignment = left_align
                ws_instructions.cell(row=curr_row, column=2, value=loc.get("name") or "Main Store").alignment = left_align
                ws_instructions.cell(row=curr_row, column=3, value="Yes (Primary)" if loc.get("isDefault") else "No").alignment = center_align
                curr_row += 1
        else:
            ws_instructions.cell(row=curr_row, column=1, value="MAIN-01")
            ws_instructions.cell(row=curr_row, column=2, value="Main Flagship Counter")
            ws_instructions.cell(row=curr_row, column=3, value="Yes (Primary)").alignment = center_align

        ws_instructions.column_dimensions["A"].width = 24
        ws_instructions.column_dimensions["B"].width = 36
        ws_instructions.column_dimensions["C"].width = 20

        bytes_io = io.BytesIO()
        wb.save(bytes_io)
        bytes_io.seek(0)
        return bytes_io, "product_import_template.xlsx", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"

    @staticmethod
    async def process_import(
        db,
        business_id: str,
        current_user: Optional[TokenPayload],
        file: UploadFile,
        location_id: Optional[str] = None,
        update_existing: bool = True,
        create_categories: bool = True,
    ) -> Dict[str, Any]:
        """
        Parses Excel (.xlsx, .xls) or CSV file, resolves categories, updates/creates products,
        applies branch-specific inventory overrides, and logs stock movements.
        """
        filename = (file.filename or "").lower()
        contents = await file.read()
        if not contents:
            raise HTTPException(status_code=400, detail="Uploaded file is empty.")

        rows_data: List[List[Any]] = []

        if filename.endswith(".csv"):
            # Try multiple encodings
            text_content = None
            for enc in ["utf-8-sig", "utf-8", "latin-1", "cp1252"]:
                try:
                    text_content = contents.decode(enc)
                    break
                except UnicodeDecodeError:
                    continue
            
            if text_content is None:
                raise HTTPException(status_code=400, detail="Unable to decode CSV file. Please ensure it is saved in UTF-8 format.")

            csv_file = io.StringIO(text_content)
            reader = csv.reader(csv_file)
            for row in reader:
                rows_data.append(row)

        elif filename.endswith((".xlsx", ".xls")):
            try:
                import openpyxl
                excel_file = io.BytesIO(contents)
                wb = openpyxl.load_workbook(excel_file, data_only=True)
                ws = wb.active
                for row in ws.iter_rows(values_only=True):
                    rows_data.append(list(row))
            except Exception as e:
                raise HTTPException(status_code=400, detail=f"Failed to parse Excel workbook: {str(e)}")
        else:
            raise HTTPException(status_code=400, detail="Unsupported file format. Please upload a .xlsx or .csv file.")

        if not rows_data or len(rows_data) < 2:
            raise HTTPException(status_code=400, detail="The file contains no data rows. Please include a header row and at least one product row.")

        # Header identification
        raw_headers = rows_data[0]
        header_map: Dict[int, str] = {}
        for col_idx, h in enumerate(raw_headers):
            if h is not None:
                canonical = _canonicalize_header(str(h))
                if canonical:
                    header_map[col_idx] = canonical

        if "name" not in header_map.values():
            raise HTTPException(
                status_code=400,
                detail="Could not detect required 'Product Name' column in header row. Please use the downloadable template."
            )

        # Load Tenant Store Branches from Primary DB (with fallback to tenant DB)
        b_queries = [{"businessId": business_id}]
        if ObjectId.is_valid(business_id):
            b_queries.append({"businessId": ObjectId(business_id)})

        primary_db = get_database()
        loc_cursor = primary_db.locations.find({"$or": b_queries})
        count_locs = await primary_db.locations.count_documents({"$or": b_queries})
        if count_locs == 0:
            loc_cursor = db.locations.find({"$or": b_queries})
            count_locs = await db.locations.count_documents({"$or": b_queries})
            if count_locs == 0:
                # Auto-initialize default location in primary DB for this tenant
                def_loc_doc = {
                    "businessId": ObjectId(business_id) if ObjectId.is_valid(business_id) else business_id,
                    "name": "Main Flagship Counter",
                    "code": "MAIN-01",
                    "isDefault": True,
                    "isActive": True,
                    "createdAt": datetime.now(timezone.utc),
                    "updatedAt": datetime.now(timezone.utc),
                }
                ins = await primary_db.locations.insert_one(def_loc_doc)
                def_loc_doc["_id"] = ins.inserted_id
                loc_cursor = primary_db.locations.find({"$or": b_queries})

        tenant_locations = []
        loc_id_map: Dict[str, dict] = {}
        loc_code_map: Dict[str, dict] = {}
        loc_name_map: Dict[str, dict] = {}
        default_location = None

        async for loc in loc_cursor:
            loc_str_id = str(loc["_id"])
            loc_dict = {
                "id": loc_str_id,
                "name": loc.get("name", "Branch Outlet"),
                "code": loc.get("code", ""),
                "isDefault": bool(loc.get("isDefault", False)),
            }
            tenant_locations.append(loc_dict)
            loc_id_map[loc_str_id] = loc_dict
            if loc.get("code"):
                loc_code_map[loc["code"].strip().upper()] = loc_dict
            if loc.get("name"):
                loc_name_map[loc["name"].strip().upper()] = loc_dict
            if loc.get("isDefault") and not default_location:
                default_location = loc_dict

        if not default_location and tenant_locations:
            default_location = tenant_locations[0]

        # Target default branch for this import
        target_default_loc = None
        if location_id and location_id != "ALL":
            clean_lid = location_id.strip()
            target_default_loc = (
                loc_id_map.get(clean_lid)
                or loc_code_map.get(clean_lid.upper())
                or loc_name_map.get(clean_lid.upper())
            )
        if not target_default_loc:
            target_default_loc = default_location

        # Load Existing Tenant Categories
        cat_cursor = db.categories.find({"$or": b_queries})
        cat_map: Dict[str, str] = {} # lower_name -> categoryId
        async for c in cat_cursor:
            c_name = c.get("name", "").strip().lower()
            if c_name:
                cat_map[c_name] = str(c["_id"])

        # User Actor Info
        user_id = str(current_user.sub) if current_user and current_user.sub else None
        user_name = await resolve_user_name(db, current_user) if current_user else "Admin Import"
        now = datetime.now(timezone.utc)
        b_oid = ObjectId(business_id) if ObjectId.is_valid(business_id) else business_id

        # Processing loop
        created_count = 0
        updated_count = 0
        skipped_count = 0
        errors_count = 0
        categories_created: List[str] = []
        errors: List[Dict[str, Any]] = []
        details: List[Dict[str, Any]] = []

        total_rows = len(rows_data) - 1

        for row_idx, row in enumerate(rows_data[1:], start=2):
            if not row or all(v is None or str(v).strip() == "" for v in row):
                continue # Skip empty lines

            # Extract fields via header mapping
            row_dict: Dict[str, Any] = {}
            for col_idx, field_key in header_map.items():
                if col_idx < len(row):
                    row_dict[field_key] = row[col_idx]

            raw_name = _clean_str(row_dict.get("name"))
            if not raw_name:
                errors_count += 1
                errors.append({"row": row_idx, "error": "Product Name is required and cannot be empty."})
                continue

            # Pricing validation
            raw_sale_price = row_dict.get("sale_price")
            sale_price = _clean_num(raw_sale_price, default=-1.0)
            if sale_price < 0:
                errors_count += 1
                errors.append({"row": row_idx, "error": f"Invalid or missing Sale Price: '{raw_sale_price}'"})
                continue

            raw_mrp = row_dict.get("mrp")
            mrp = _clean_num(raw_mrp, default=sale_price) if raw_mrp is not None else sale_price
            if mrp < sale_price:
                mrp = sale_price

            purchase_price = max(0.0, _clean_num(row_dict.get("purchase_price"), default=0.0))
            tax_rate = max(0.0, _clean_num(row_dict.get("tax_rate"), default=0.0))
            opening_stock = _clean_num(row_dict.get("opening_stock"), default=0.0)
            min_stock_alert = max(0.0, _clean_num(row_dict.get("min_stock_alert"), default=5.0))
            sku = _clean_str(row_dict.get("sku"))
            barcode = _clean_str(row_dict.get("barcode"))
            unit = _clean_str(row_dict.get("unit")) or "pcs"
            description = _clean_str(row_dict.get("description"))

            # Resolve Category
            category_name = _clean_str(row_dict.get("category")) or "General"
            cat_key = category_name.lower()
            category_id = cat_map.get(cat_key)

            if not category_id and create_categories:
                # Auto-create new category
                try:
                    new_cat_doc = {
                        "businessId": b_oid,
                        "name": category_name,
                        "type": "PRODUCT",
                        "description": "Auto-created from product bulk import",
                        "createdAt": now,
                        "updatedAt": now,
                    }
                    cat_res = await db.categories.insert_one(new_cat_doc)
                    category_id = str(cat_res.inserted_id)
                    cat_map[cat_key] = category_id
                    if category_name not in categories_created:
                        categories_created.append(category_name)
                except Exception as ex:
                    logger.warning(f"Could not auto-create category '{category_name}': {ex}")

            # Resolve Branch
            row_branch = _clean_str(row_dict.get("branch"))
            resolved_loc = None
            if row_branch:
                r_up = row_branch.upper()
                resolved_loc = loc_id_map.get(row_branch) or loc_code_map.get(r_up) or loc_name_map.get(r_up)
            if not resolved_loc:
                resolved_loc = target_default_loc

            row_loc_id = resolved_loc.get("id") if resolved_loc else (tenant_locations[0]["id"] if tenant_locations else "MAIN-01")
            row_loc_name = resolved_loc.get("name") if resolved_loc else (tenant_locations[0]["name"] if tenant_locations else "Main Branch")

            # Check for existing product: Barcode -> SKU -> Name
            existing = None
            if barcode:
                existing = await db.items.find_one({"$or": b_queries, "barcode": barcode})
            if not existing and sku:
                existing = await db.items.find_one({"$or": b_queries, "sku": {"$regex": f"^{re.escape(sku)}$", "$options": "i"}})
            if not existing:
                existing = await db.items.find_one({"$or": b_queries, "name": {"$regex": f"^{re.escape(raw_name)}$", "$options": "i"}})

            if existing:
                if not update_existing:
                    skipped_count += 1
                    details.append({
                        "row": row_idx,
                        "name": raw_name,
                        "sku": sku,
                        "barcode": barcode,
                        "status": "SKIPPED",
                        "message": "Product already exists and update option was disabled."
                    })
                    continue

                # UPDATE EXISTING PRODUCT
                item_id = existing["_id"]
                update_fields: Dict[str, Any] = {
                    "updatedAt": now,
                }
                # Update basic metadata if provided
                if raw_name:
                    update_fields["name"] = raw_name
                if category_name:
                    update_fields["category"] = category_name
                if category_id:
                    update_fields["categoryId"] = category_id
                if sku:
                    update_fields["sku"] = sku
                if barcode:
                    update_fields["barcode"] = barcode
                if unit:
                    update_fields["unit"] = unit
                if description:
                    update_fields["description"] = description
                if tax_rate is not None:
                    update_fields["taxRate"] = tax_rate
                if min_stock_alert is not None:
                    update_fields["minStockAlert"] = min_stock_alert

                # Update master salePrice, MRP & purchasePrice if this is default/primary branch, or no branch override was in the row, or single branch tenant
                is_master_update = (
                    not row_branch
                    or (resolved_loc and resolved_loc.get("isDefault"))
                    or len(tenant_locations) <= 1
                )
                if is_master_update:
                    update_fields["salePrice"] = sale_price
                    update_fields["mrp"] = mrp
                    if purchase_price > 0:
                        update_fields["purchasePrice"] = purchase_price

                # Update Branch Locations array
                locs = list(existing.get("locations") or [])
                # Clean up dummy MAIN-01 if real locations are now resolved
                if tenant_locations:
                    locs = [l for l in locs if str(l.get("locationId")) != "MAIN-01"]

                found_loc = False
                stock_delta = 0.0
                old_loc_stock = 0.0

                for loc_entry in locs:
                    if str(loc_entry.get("locationId")) == str(row_loc_id):
                        found_loc = True
                        loc_entry["salePrice"] = sale_price
                        loc_entry["mrp"] = mrp
                        if purchase_price > 0:
                            loc_entry["purchasePrice"] = purchase_price
                        loc_entry["minStockAlert"] = min_stock_alert
                        loc_entry["isListed"] = True

                        if "opening_stock" in row_dict and row_dict["opening_stock"] is not None:
                            old_loc_stock = float(loc_entry.get("currentStock", 0.0) or 0.0)
                            new_loc_stock = max(0.0, opening_stock)
                            stock_delta = new_loc_stock - old_loc_stock
                            loc_entry["currentStock"] = new_loc_stock
                        break

                if not found_loc:
                    if is_master_update and not locs:
                        old_loc_stock = float(existing.get("currentStock", 0.0) or 0.0)
                    locs.append({
                        "locationId": row_loc_id,
                        "locationName": row_loc_name,
                        "mrp": mrp,
                        "salePrice": sale_price,
                        "purchasePrice": purchase_price,
                        "currentStock": max(0.0, opening_stock),
                        "minStockAlert": min_stock_alert,
                        "isListed": True,
                        "hasDiscount": False,
                        "discountType": "PERCENT",
                        "discountValue": 0.0,
                    })
                    stock_delta = max(0.0, opening_stock) - old_loc_stock

                # Ensure all tenant locations are populated in locs with isListed: True
                present_loc_ids = {str(l.get("locationId")) for l in locs if l.get("locationId")}
                for t_loc in tenant_locations:
                    t_id = t_loc["id"]
                    if t_id not in present_loc_ids:
                        locs.append({
                            "locationId": t_id,
                            "locationName": t_loc["name"],
                            "mrp": mrp,
                            "salePrice": sale_price,
                            "purchasePrice": purchase_price,
                            "currentStock": 0.0,
                            "minStockAlert": min_stock_alert,
                            "isListed": True,
                            "hasDiscount": False,
                            "discountType": "PERCENT",
                            "discountValue": 0.0,
                        })
                        present_loc_ids.add(t_id)

                update_fields["locations"] = locs

                # Adjust master aggregate stock if stock changed
                if stock_delta != 0:
                    current_master_stock = float(existing.get("currentStock", 0.0) or 0.0)
                    new_master_stock = max(0.0, current_master_stock + stock_delta)
                    update_fields["currentStock"] = round(new_master_stock, 3)

                    # Log movement to immutable inventory ledger
                    movement_doc = {
                        "businessId": b_oid,
                        "itemId": item_id if isinstance(item_id, ObjectId) else ObjectId(item_id),
                        "publicItemId": existing.get("publicItemId"),
                        "itemName": raw_name,
                        "sku": sku or existing.get("sku"),
                        "locationId": row_loc_id,
                        "locationName": row_loc_name,
                        "type": "OPENING_STOCK" if old_loc_stock == 0 and stock_delta > 0 else "MANUAL_ADJUSTMENT",
                        "referenceType": "BULK_IMPORT",
                        "referenceId": str(item_id),
                        "referenceNumber": "BULK-IMPORT",
                        "quantityChange": round(stock_delta, 3),
                        "quantityBefore": round(old_loc_stock, 3),
                        "quantityAfter": round(old_loc_stock + stock_delta, 3),
                        "unitCost": purchase_price or float(existing.get("purchasePrice", 0.0) or 0.0),
                        "totalCost": round(abs(stock_delta) * (purchase_price or float(existing.get("purchasePrice", 0.0) or 0.0)), 2),
                        "reason": "Bulk Import Update",
                        "notes": f"Updated via spreadsheet import for branch {row_loc_name}",
                        "createdByUserId": user_id,
                        "createdByName": user_name,
                        "createdAt": now,
                    }
                    await db.inventory_movements.insert_one(movement_doc)

                await db.items.update_one({"_id": item_id}, {"$set": update_fields})
                updated_count += 1
                details.append({
                    "row": row_idx,
                    "name": raw_name,
                    "sku": sku or existing.get("sku"),
                    "barcode": barcode or existing.get("barcode"),
                    "status": "UPDATED",
                    "publicItemId": existing.get("publicItemId"),
                    "branch": row_loc_name,
                })

            else:
                # CREATE NEW PRODUCT
                public_id = f"itm_{secrets.token_hex(6)}"
                locations_data = []

                # Build locations array with initial stock allocated to the target branch
                for t_loc in tenant_locations:
                    t_loc_id = t_loc["id"]
                    is_target = (t_loc_id == row_loc_id)
                    locations_data.append({
                        "locationId": t_loc_id,
                        "locationName": t_loc["name"],
                        "mrp": mrp,
                        "salePrice": sale_price,
                        "purchasePrice": purchase_price,
                        "currentStock": max(0.0, opening_stock) if is_target else 0.0,
                        "minStockAlert": min_stock_alert,
                        "isListed": True,
                        "hasDiscount": False,
                        "discountType": "PERCENT",
                        "discountValue": 0.0,
                    })

                if not locations_data:
                    locations_data.append({
                        "locationId": row_loc_id,
                        "locationName": row_loc_name,
                        "mrp": mrp,
                        "salePrice": sale_price,
                        "purchasePrice": purchase_price,
                        "currentStock": max(0.0, opening_stock),
                        "minStockAlert": min_stock_alert,
                        "isListed": True,
                        "hasDiscount": False,
                        "discountType": "PERCENT",
                        "discountValue": 0.0,
                    })

                new_item_doc = {
                    "businessId": b_oid,
                    "publicItemId": public_id,
                    "name": raw_name,
                    "sku": sku,
                    "barcode": barcode,
                    "category": category_name,
                    "unit": unit,
                    "purchasePrice": purchase_price,
                    "averageCostPrice": purchase_price,
                    "salePrice": sale_price,
                    "mrp": mrp,
                    "taxRate": tax_rate,
                    "categoryId": category_id,
                    "currentStock": max(0.0, opening_stock),
                    "minStockAlert": min_stock_alert,
                    "allowParts": False,
                    "description": description,
                    "hasDiscount": False,
                    "discountType": "PERCENT",
                    "discountValue": 0.0,
                    "locations": locations_data,
                    "images": [],
                    "imageUrl": None,
                    "qrPayload": f"ITEM:{public_id}",
                    "isActive": True,
                    "createdAt": now,
                    "updatedAt": now,
                }

                ins_res = await db.items.insert_one(new_item_doc)
                new_doc_id = ins_res.inserted_id

                if opening_stock > 0:
                    movement_doc = {
                        "businessId": b_oid,
                        "itemId": new_doc_id,
                        "publicItemId": public_id,
                        "itemName": raw_name,
                        "sku": sku,
                        "locationId": row_loc_id,
                        "locationName": row_loc_name,
                        "type": "OPENING_STOCK",
                        "referenceType": "BULK_IMPORT",
                        "referenceId": str(new_doc_id),
                        "referenceNumber": "BULK-IMPORT",
                        "quantityChange": max(0.0, opening_stock),
                        "quantityBefore": 0.0,
                        "quantityAfter": max(0.0, opening_stock),
                        "unitCost": purchase_price,
                        "totalCost": round(max(0.0, opening_stock) * purchase_price, 2),
                        "reason": "Initial Opening Stock via Bulk Product Import",
                        "notes": f"Imported into store branch: {row_loc_name}",
                        "createdByUserId": user_id,
                        "createdByName": user_name,
                        "createdAt": now,
                    }
                    await db.inventory_movements.insert_one(movement_doc)

                created_count += 1
                details.append({
                    "row": row_idx,
                    "name": raw_name,
                    "sku": sku,
                    "barcode": barcode,
                    "status": "CREATED",
                    "publicItemId": public_id,
                    "branch": row_loc_name,
                })

        return {
            "success": True,
            "totalRows": total_rows,
            "processedCount": created_count + updated_count + skipped_count,
            "createdCount": created_count,
            "updatedCount": updated_count,
            "skippedCount": skipped_count,
            "errorsCount": errors_count,
            "categoriesCreated": categories_created,
            "errors": errors,
            "details": details,
        }
