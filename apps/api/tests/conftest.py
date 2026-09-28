import pytest
import copy
from typing import Dict, Any, List, Optional
from bson import ObjectId
from app.main import app
from app.core.database import get_database

class MockCursor:
    def __init__(self, docs: List[Dict[str, Any]]):
        self.docs = docs
        self._index = 0

    def __aiter__(self):
        self._index = 0
        return self

    async def __anext__(self):
        if self._index < len(self.docs):
            doc = copy.deepcopy(self.docs[self._index])
            self._index += 1
            return doc
        raise StopAsyncIteration

    def sort(self, key: str, direction: int = 1):
        # basic sort
        return self

    def skip(self, n: int):
        self.docs = self.docs[n:]
        return self

    def limit(self, n: int):
        self.docs = self.docs[:n]
        return self

    async def to_list(self, length: Optional[int] = None) -> List[Dict[str, Any]]:
        if length is not None:
            return [copy.deepcopy(d) for d in self.docs[:length]]
        return [copy.deepcopy(d) for d in self.docs]

class MockInsertResult:
    def __init__(self, inserted_id):
        self.inserted_id = inserted_id

class MockUpdateResult:
    def __init__(self, modified_count, matched_count=None):
        self.modified_count = modified_count
        self.matched_count = matched_count if matched_count is not None else modified_count

class MockDeleteResult:
    def __init__(self, deleted_count):
        self.deleted_count = deleted_count

def _apply_set(doc: Dict[str, Any], set_dict: Dict[str, Any]):
    for key, val in set_dict.items():
        if "." in key:
            parts = key.split(".")
            curr = doc
            for part in parts[:-1]:
                if part not in curr or not isinstance(curr[part], dict):
                    curr[part] = {}
                curr = curr[part]
            curr[parts[-1]] = copy.deepcopy(val)
        else:
            doc[key] = copy.deepcopy(val)

class MockCollection:
    def __init__(self, name: str):
        self.name = name
        self.data: List[Dict[str, Any]] = []

    def _matches(self, doc: Dict[str, Any], query: Dict[str, Any]) -> bool:
        for k, v in query.items():
            if k == "$or":
                matched_any = False
                for subq in v:
                    if self._matches(doc, subq):
                        matched_any = True
                        break
                if not matched_any:
                    return False
                continue
            if k == "$and":
                for subq in v:
                    if not self._matches(doc, subq):
                        return False
                continue
            if k == "$expr":
                continue
            
            doc_val = doc.get(k)
            # Handle ObjectId or str equality
            if isinstance(v, (str, ObjectId)) and isinstance(doc_val, (str, ObjectId)):
                if str(doc_val) != str(v):
                    return False
            elif isinstance(v, dict):
                if "$regex" in v:
                    pattern = v["$regex"].lower()
                    if pattern not in str(doc_val).lower():
                        return False
            else:
                if doc_val != v:
                    return False
        return True

    async def find_one(self, filter_query: Dict[str, Any], session=None) -> Optional[Dict[str, Any]]:
        for d in self.data:
            if self._matches(d, filter_query):
                return copy.deepcopy(d)
        return None

    def find(self, filter_query: Dict[str, Any] = None) -> MockCursor:
        q = filter_query or {}
        matches = [d for d in self.data if self._matches(d, q)]
        return MockCursor(matches)

    async def count_documents(self, filter_query: Dict[str, Any]) -> int:
        return len([d for d in self.data if self._matches(d, filter_query)])

    async def insert_one(self, doc: Dict[str, Any], session=None) -> MockInsertResult:
        doc_copy = copy.deepcopy(doc)
        if "_id" not in doc_copy:
            doc_copy["_id"] = ObjectId()
        self.data.append(doc_copy)
        return MockInsertResult(doc_copy["_id"])

    async def update_one(self, filter_query: Dict[str, Any], update: Dict[str, Any], session=None, upsert: bool = False) -> MockUpdateResult:
        for d in self.data:
            if self._matches(d, filter_query):
                if "$set" in update:
                    _apply_set(d, update["$set"])
                if "$inc" in update:
                    for field, inc_val in update["$inc"].items():
                        d[field] = d.get(field, 0) + inc_val
                return MockUpdateResult(1)
        if upsert:
            new_doc = copy.deepcopy(filter_query)
            if "_id" not in new_doc:
                new_doc["_id"] = ObjectId()
            if "$set" in update:
                _apply_set(new_doc, update["$set"])
            if "$inc" in update:
                for field, inc_val in update["$inc"].items():
                    new_doc[field] = inc_val
            self.data.append(new_doc)
            return MockUpdateResult(1)
        return MockUpdateResult(0)

    async def delete_one(self, filter_query: Dict[str, Any], session=None) -> MockDeleteResult:
        for idx, d in enumerate(self.data):
            if self._matches(d, filter_query):
                del self.data[idx]
                return MockDeleteResult(1)
        return MockDeleteResult(0)

    def aggregate(self, pipeline: List[Dict[str, Any]]) -> MockCursor:
        # Simple aggregate simulation for tests
        results = []
        return MockCursor(results)

class MockDatabase:
    def __init__(self, name: str = "primary"):
        self.name = name
        self.collections: Dict[str, MockCollection] = {}

    def __getitem__(self, name: str) -> MockCollection:
        if name not in self.collections:
            self.collections[name] = MockCollection(name)
        return self.collections[name]

    def __getattr__(self, name: str) -> MockCollection:
        return self[name]

    async def command(self, cmd: str) -> Dict[str, Any]:
        return {"ok": 1}

@pytest.fixture(autouse=True)
def override_db(monkeypatch):
    from app.core.security import get_password_hash
    from app.core.database import db_manager

    mock_primary_db = MockDatabase("primary_db")
    mock_tenant_dbs = {}
    
    # Seed default store admin user
    mock_primary_db.users.data.append({
        "_id": ObjectId("65f2a1b9a000000000000011"),
        "name": "QuickBill Store Admin",
        "email": "admin@quickbill.local",
        "passwordHash": get_password_hash("admin123"),
        "hashedPassword": get_password_hash("admin123"),
        "roles": ["TENANT_ADMIN"],
        "tenantId": ObjectId("65f2a1b9a000000000000001"),
        "authorizedTenantIds": ["65f2a1b9a000000000000001"],
        "isActive": True
    })

    # Seed default store B tenant
    mock_primary_db.tenants.data.append({
        "_id": ObjectId("65f2a1b9a000000000000002"),
        "slug": "65f2a1b9a000000000000002",
        "name": "Store B",
        "status": "ACTIVE",
        "subscription": {
            "status": "ACTIVE",
            "tier": "GROWTH",
            "maxUsers": 10,
            "maxLocations": 3,
            "endDate": "2027-01-01T00:00:00Z"
        }
    })

    app.dependency_overrides[get_database] = lambda: mock_primary_db
    monkeypatch.setattr(db_manager, "get_primary_database", lambda: mock_primary_db)

    async def mock_get_tenant_db(business_id):
        if not business_id or business_id == "system_platform":
            return mock_primary_db
        bid_str = str(business_id)
        if bid_str not in mock_tenant_dbs:
            mock_tenant_dbs[bid_str] = MockDatabase(f"tenant_{bid_str}")
        return mock_tenant_dbs[bid_str]

    monkeypatch.setattr(db_manager, "get_tenant_database", mock_get_tenant_db)
    yield mock_primary_db
    app.dependency_overrides.clear()
