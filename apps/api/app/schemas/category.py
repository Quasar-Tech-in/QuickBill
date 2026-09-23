from datetime import datetime
from typing import Optional
from pydantic import BaseModel, ConfigDict, Field

class CategoryBase(BaseModel):
    name: str = Field(..., min_length=1, max_length=100)
    description: Optional[str] = Field(None, max_length=500)

class CategoryCreate(CategoryBase):
    pass

class CategoryUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=100)
    description: Optional[str] = Field(None, max_length=500)

class CategoryResponse(CategoryBase):
    id: str = Field(..., alias="_id")
    business_id: str = Field(..., alias="businessId")
    created_at: datetime = Field(..., alias="createdAt")

    model_config = ConfigDict(
        populate_by_name=True,
        json_encoders={datetime: lambda dt: dt.isoformat()}
    )
