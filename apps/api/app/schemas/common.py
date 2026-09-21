from typing import Generic, List, TypeVar, Optional
from pydantic import BaseModel, Field, ConfigDict

T = TypeVar("T")

class BaseSchema(BaseModel):
    model_config = ConfigDict(populate_by_name=True, from_attributes=True)

class PaginationParams(BaseModel):
    page: int = Field(default=1, ge=1)
    page_size: int = Field(default=20, ge=1, le=100)
    sort_by: str = Field(default="createdAt")
    sort_dir: int = Field(default=-1)  # -1 desc, 1 asc

class PaginatedResponse(BaseModel, Generic[T]):
    data: List[T]
    page: int
    page_size: int
    total: int
    total_pages: int
