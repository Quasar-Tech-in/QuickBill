import pytest
import copy
from typing import Dict, Any, List, Optional
from bson import ObjectId
from app.main import app
from app.core.database import get_database

class MockCursor:
    def __init__(self, docs: List[Dict[str, Any]]):
        self.docs = docs

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
    def __init__(self, modified_count):
        self.modified_count = modified_count

class MockDeleteResult:
    def __init__(self, deleted_count):
        self.deleted_count = deleted_count

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

    async def update_one(self, filter_query: Dict[str, Any], update: Dict[str, Any], session=None) -> MockUpdateResult:
        for d in self.data:
            if self._matches(d, filter_query):
                if "$set" in update:
                    d.update(copy.deepcopy(update["$set"]))
                if "$inc" in update:
                    for field, inc_val in update["$inc"].items():
                        d[field] = d.get(field, 0) + inc_val
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
    def __init__(self):
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
def override_db():
    mock_db = MockDatabase()
    app.dependency_overrides[get_database] = lambda: mock_db
    yield mock_db
    app.dependency_overrides.clear()
